import pool from "./db.js";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

// ============ GET HISTORY ============
async function getHistory(req, res) {
  const limit = parseInt(String(req.query?.limit ?? ""), 10) || 5;
  const offset = parseInt(String(req.query?.offset ?? ""), 10) || 0;

  try {
    const query = `
      SELECT 
        id, ticker, signal, entry_price, tp1, tp2, stop_loss, 
        highest_price, lowest_price, status, date_created
      FROM analysis_history
      ORDER BY date_created DESC
      LIMIT $1 OFFSET $2
    `;

    const { rows } = await pool.query(query, [limit, offset]);

    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate");
    return res.status(200).json(rows);
  } catch (error) {
    console.error("History API Error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal error",
    });
  }
}

// ============ SAVE ANALYSIS ============
async function saveAnalysis(req, res) {
  const { ticker, signal, entry_price, tp1, tp2, stop_loss, reasoning } = req.body || {};

  if (!ticker || !signal || typeof entry_price !== "number") {
    return res.status(400).json({
      error: "ticker, signal, and numeric entry_price are required",
    });
  }

  try {
    const query = `
      INSERT INTO analysis_history 
      (ticker, signal, entry_price, tp1, tp2, stop_loss, highest_price, lowest_price, status, reasoning, date_created)
      VALUES ($1, $2, $3, $4, $5, $6, $3, $3, 'ACTIVE', $7, NOW())
      RETURNING id
    `;

    const values = [ticker, signal, entry_price, tp1, tp2, stop_loss, reasoning];
    const { rows } = await pool.query(query, values);

    return res.status(201).json({ message: "Saved", id: rows[0].id });
  } catch (error) {
    console.error("Save API Error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal error",
    });
  }
}

// ============ UPDATE STATUS ============
async function updateStatus(req, res) {
  try {
    const { rows: activeAnalyses } = await pool.query(
      `
      SELECT 
        id, ticker, signal, entry_price, tp1, tp2, stop_loss,
        highest_price, lowest_price, status
      FROM analysis_history
      WHERE status = 'ACTIVE'
      `
    );

    let updatedCount = 0;

    for (const analysis of activeAnalyses) {
      try {
        const quote = await yahooFinance.quote(analysis.ticker);
        let currentPrice =
          quote.regularMarketPrice ?? quote.postMarketPrice ?? quote.preMarketPrice;

        if (typeof currentPrice !== "number") {
          console.warn(`No usable price for ${analysis.ticker}, skipping update`);
          continue;
        }

        let highest = analysis.highest_price ?? analysis.entry_price;
        let lowest = analysis.lowest_price ?? analysis.entry_price;
        let status = analysis.status;

        if (currentPrice > highest) highest = currentPrice;
        if (currentPrice < lowest) lowest = currentPrice;

        if (analysis.signal === "BUY") {
          if (currentPrice >= analysis.tp2) {
            status = "TP2 HIT";
          } else if (currentPrice >= analysis.tp1) {
            if (status !== "TP2 HIT") {
              status = "TP1 HIT";
            }
          } else if (currentPrice <= analysis.stop_loss) {
            status = "SL HIT";
          }
        } else if (analysis.signal === "SELL") {
          if (currentPrice <= analysis.tp2) {
            status = "TP2 HIT";
          } else if (currentPrice <= analysis.tp1) {
            if (status !== "TP2 HIT") {
              status = "TP1 HIT";
            }
          } else if (currentPrice >= analysis.stop_loss) {
            status = "SL HIT";
          }
        }

        await pool.query(
          `
          UPDATE analysis_history
          SET highest_price = $1,
              lowest_price  = $2,
              status        = $3
          WHERE id = $4
          `,
          [highest, lowest, status, analysis.id]
        );

        updatedCount += 1;
      } catch (err) {
        console.error(`Error updating analysis ${analysis.id}:`, err);
        continue;
      }
    }

    return res.status(200).json({ message: "Status updated", updated_count: updatedCount });
  } catch (error) {
    console.error("Update-status API Error:", error);
    return res
      .status(500)
      .json({ error: error instanceof Error ? error.message : "Internal error" });
  }
}

// ============ MAIN HANDLER ============
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const path = req.url.split("?")[0].replace("/api/history", "");

  // Route: GET /api/history - get history list
  if (req.method === "GET" && (path === "" || path === "/")) {
    return getHistory(req, res);
  }

  // Route: POST /api/history/save - save new analysis
  if (req.method === "POST" && path === "/save") {
    return saveAnalysis(req, res);
  }

  // Route: POST /api/history/update-status - update all active analyses status
  if (req.method === "POST" && path === "/update-status") {
    return updateStatus(req, res);
  }

  return res.status(404).json({ error: "Endpoint not found" });
}
