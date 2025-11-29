import pool from "./db.js";
import { verifyToken } from "./auth.js";

// Initialize watchlist table
const initDb = async () => {
  try {
    // First ensure users table exists (in case auth.js hasn't run yet)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS watchlist (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ticker VARCHAR(20) NOT NULL,
        name VARCHAR(255),
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, ticker)
      )
    `);
    
    // Add name column if it doesn't exist (for existing tables)
    await pool.query(`
      ALTER TABLE watchlist 
      ADD COLUMN IF NOT EXISTS name VARCHAR(255)
    `);
    
    console.log("Watchlist table initialized");
  } catch (error) {
    console.error("Error initializing watchlist table:", error);
  }
};

// Don't block module loading - init asynchronously
initDb().catch(console.error);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
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
  
  // Parse URL for query params
  const url = new URL(req.url, `http://${req.headers.host}`);
  const queryParams = Object.fromEntries(url.searchParams);

  try {
    // GET - Get user's watchlist
    if (req.method === "GET") {
      const result = await pool.query(
        "SELECT id, ticker, name, added_at FROM watchlist WHERE user_id = $1 ORDER BY added_at DESC",
        [userId]
      );

      return res.json({
        success: true,
        watchlist: result.rows.map((w) => ({
          id: w.id,
          ticker: w.ticker,
          name: w.name,
          addedAt: w.added_at,
        })),
      });
    }

    // POST - Add to watchlist
    if (req.method === "POST") {
      const { ticker, name } = req.body;

      if (!ticker) {
        return res.status(400).json({ success: false, message: "Ticker harus diisi" });
      }

      const normalizedTicker = ticker.toUpperCase();

      // Check if already exists
      const existing = await pool.query(
        "SELECT id FROM watchlist WHERE user_id = $1 AND ticker = $2",
        [userId, normalizedTicker]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ success: false, message: "Ticker sudah ada di watchlist" });
      }

      const result = await pool.query(
        "INSERT INTO watchlist (user_id, ticker, name) VALUES ($1, $2, $3) RETURNING id, ticker, name, added_at",
        [userId, normalizedTicker, name || null]
      );

      const item = result.rows[0];
      return res.status(201).json({
        success: true,
        message: "Berhasil ditambahkan ke watchlist",
        item: {
          id: item.id,
          ticker: item.ticker,
          name: item.name,
          addedAt: item.added_at,
        },
      });
    }

    // DELETE - Remove from watchlist
    if (req.method === "DELETE") {
      const ticker = queryParams.ticker || (req.body && req.body.ticker);

      if (!ticker) {
        return res.status(400).json({ success: false, message: "Ticker harus diisi" });
      }

      await pool.query("DELETE FROM watchlist WHERE user_id = $1 AND ticker = $2", [
        userId,
        ticker.toUpperCase(),
      ]);

      return res.json({ success: true, message: "Berhasil dihapus dari watchlist" });
    }

    return res.status(405).json({ success: false, message: "Method tidak diizinkan" });
  } catch (error) {
    console.error("Watchlist error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
}
