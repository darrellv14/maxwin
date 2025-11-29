import pool from "./db.js";
import YahooFinance from "yahoo-finance2";

// Satu instance untuk reuse connection / cookies
const yahooFinance = new YahooFinance();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Ambil semua analysis yang masih ACTIVE
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

    // Loop tiap analysis dan update status + high/low
    for (const analysis of activeAnalyses) {
      try {
        // Ambil harga sekarang dari Yahoo Finance
        const quote = await yahooFinance.quote(analysis.ticker);
        // regularMarketPrice adalah harga “normal market” utama :contentReference[oaicite:1]{index=1}
        let currentPrice =
          quote.regularMarketPrice ?? quote.postMarketPrice ?? quote.preMarketPrice;

        if (typeof currentPrice !== "number") {
          console.warn(`No usable price for ${analysis.ticker}, skipping update`);
          continue;
        }

        let highest = analysis.highest_price ?? analysis.entry_price;
        let lowest = analysis.lowest_price ?? analysis.entry_price;
        let status = analysis.status;

        // Update high / low
        if (currentPrice > highest) highest = currentPrice;
        if (currentPrice < lowest) lowest = currentPrice;

        // Logic sama kayak FastAPI versi Python
        if (analysis.signal === "BUY") {
          if (currentPrice >= analysis.tp2) {
            status = "TP2 HIT";
          } else if (currentPrice >= analysis.tp1) {
            // Kalau belum TP2, set TP1
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

        // Commit ke DB
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
        // lanjut ke row berikutnya
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
