import pool from "./db.js";
import { verifyToken } from "./auth.js";

// Initialize portfolio tables
const initDb = async () => {
  try {
    // Positions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS portfolio_positions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ticker VARCHAR(20) NOT NULL,
        name VARCHAR(255),
        shares DECIMAL(15, 4) NOT NULL,
        avg_price DECIMAL(15, 2) NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, ticker)
      )
    `);

    // Transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS portfolio_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ticker VARCHAR(20) NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('buy', 'sell')),
        shares DECIMAL(15, 4) NOT NULL,
        price DECIMAL(15, 2) NOT NULL,
        total_value DECIMAL(15, 2) NOT NULL,
        notes TEXT,
        transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Portfolio tables initialized");
  } catch (error) {
    console.error("Error initializing portfolio tables:", error);
  }
};

initDb();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const payload = verifyToken(authHeader.substring(7));
  if (!payload) {
    return res.status(401).json({ success: false, message: "Token tidak valid" });
  }

  const userId = payload.userId;
  const path = req.url.split("?")[0].replace("/api/portfolio", "");

  try {
    // GET /positions - Get all positions
    if ((path === "" || path === "/positions") && req.method === "GET") {
      const result = await pool.query(
        `SELECT id, ticker, name, shares, avg_price, added_at, updated_at 
         FROM portfolio_positions 
         WHERE user_id = $1 
         ORDER BY added_at DESC`,
        [userId]
      );

      return res.json({
        success: true,
        positions: result.rows.map((p) => ({
          id: p.id,
          ticker: p.ticker,
          name: p.name,
          shares: parseFloat(p.shares),
          avgPrice: parseFloat(p.avg_price),
          addedAt: p.added_at,
          updatedAt: p.updated_at,
        })),
      });
    }

    // GET /transactions - Get all transactions
    if (path === "/transactions" && req.method === "GET") {
      const limit = parseInt(req.query?.limit) || 50;
      const offset = parseInt(req.query?.offset) || 0;

      const result = await pool.query(
        `SELECT id, ticker, type, shares, price, total_value, notes, transaction_date 
         FROM portfolio_transactions 
         WHERE user_id = $1 
         ORDER BY transaction_date DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      return res.json({
        success: true,
        transactions: result.rows.map((t) => ({
          id: t.id,
          ticker: t.ticker,
          type: t.type,
          shares: parseFloat(t.shares),
          price: parseFloat(t.price),
          totalValue: parseFloat(t.total_value),
          notes: t.notes,
          date: t.transaction_date,
        })),
      });
    }

    // GET /summary - Get portfolio summary
    if (path === "/summary" && req.method === "GET") {
      const positionsResult = await pool.query(
        `SELECT ticker, shares, avg_price FROM portfolio_positions WHERE user_id = $1`,
        [userId]
      );

      const positions = positionsResult.rows;
      let totalCost = 0;
      let totalValue = 0;

      for (const p of positions) {
        const shares = parseFloat(p.shares);
        const avgPrice = parseFloat(p.avg_price);
        totalCost += shares * avgPrice;
        // Note: For real value, you'd need to fetch current prices
        totalValue += shares * avgPrice; // Placeholder
      }

      return res.json({
        success: true,
        summary: {
          totalPositions: positions.length,
          totalCost,
          totalValue,
          totalPnL: totalValue - totalCost,
          totalPnLPercent: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
        },
      });
    }

    // POST /transaction - Add a transaction (buy/sell)
    if (path === "/transaction" && req.method === "POST") {
      const { ticker, type, shares, price, notes } = req.body;

      if (!ticker || !type || !shares || !price) {
        return res.status(400).json({
          success: false,
          message: "Ticker, type, shares, dan price harus diisi",
        });
      }

      if (!["buy", "sell"].includes(type)) {
        return res.status(400).json({ success: false, message: "Type harus 'buy' atau 'sell'" });
      }

      const normalizedTicker = ticker.toUpperCase();
      const totalValue = parseFloat(shares) * parseFloat(price);

      // Start transaction
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Add transaction record
        await client.query(
          `INSERT INTO portfolio_transactions (user_id, ticker, type, shares, price, total_value, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [userId, normalizedTicker, type, shares, price, totalValue, notes || null]
        );

        // Update position
        const existingPosition = await client.query(
          "SELECT id, shares, avg_price FROM portfolio_positions WHERE user_id = $1 AND ticker = $2",
          [userId, normalizedTicker]
        );

        if (type === "buy") {
          if (existingPosition.rows.length > 0) {
            // Update existing position with new average price
            const existing = existingPosition.rows[0];
            const existingShares = parseFloat(existing.shares);
            const existingAvgPrice = parseFloat(existing.avg_price);
            const newShares = existingShares + parseFloat(shares);
            const newAvgPrice =
              (existingShares * existingAvgPrice + parseFloat(shares) * parseFloat(price)) /
              newShares;

            await client.query(
              `UPDATE portfolio_positions 
               SET shares = $1, avg_price = $2, updated_at = CURRENT_TIMESTAMP 
               WHERE id = $3`,
              [newShares, newAvgPrice, existing.id]
            );
          } else {
            // Create new position
            await client.query(
              `INSERT INTO portfolio_positions (user_id, ticker, shares, avg_price)
               VALUES ($1, $2, $3, $4)`,
              [userId, normalizedTicker, shares, price]
            );
          }
        } else if (type === "sell") {
          if (existingPosition.rows.length === 0) {
            throw new Error("Tidak ada posisi untuk dijual");
          }

          const existing = existingPosition.rows[0];
          const existingShares = parseFloat(existing.shares);
          const sellShares = parseFloat(shares);

          if (sellShares > existingShares) {
            throw new Error("Jumlah jual melebihi posisi yang dimiliki");
          }

          const newShares = existingShares - sellShares;

          if (newShares <= 0) {
            // Remove position entirely
            await client.query("DELETE FROM portfolio_positions WHERE id = $1", [existing.id]);
          } else {
            // Update shares (avg price stays the same)
            await client.query(
              `UPDATE portfolio_positions 
               SET shares = $1, updated_at = CURRENT_TIMESTAMP 
               WHERE id = $2`,
              [newShares, existing.id]
            );
          }
        }

        await client.query("COMMIT");

        return res.status(201).json({
          success: true,
          message: `Transaksi ${type.toUpperCase()} berhasil dicatat`,
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    // DELETE /position/:ticker - Remove entire position
    if (path.startsWith("/position/") && req.method === "DELETE") {
      const ticker = path.split("/")[2]?.toUpperCase();

      if (!ticker) {
        return res.status(400).json({ success: false, message: "Ticker harus diisi" });
      }

      await pool.query("DELETE FROM portfolio_positions WHERE user_id = $1 AND ticker = $2", [
        userId,
        ticker,
      ]);

      return res.json({ success: true, message: "Posisi berhasil dihapus" });
    }

    return res.status(404).json({ success: false, message: "Endpoint tidak ditemukan" });
  } catch (error) {
    console.error("Portfolio error:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
}
