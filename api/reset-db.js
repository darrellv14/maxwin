import pool from "./db.js";

// ONE-TIME USE: Reset database for fresh production start
// DELETE THIS FILE AFTER USE!

const RESET_SECRET = "moocuan-reset-2024"; // Change this or use env var

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Security check
  const { secret } = req.body || {};
  if (secret !== RESET_SECRET) {
    return res.status(401).json({ error: "Invalid secret" });
  }

  try {
    // Drop tables in correct order (respect foreign keys)
    await pool.query(`
      -- Drop dependent tables first
      DROP TABLE IF EXISTS portfolio_transactions CASCADE;
      DROP TABLE IF EXISTS price_alerts CASCADE;
      DROP TABLE IF EXISTS watchlist CASCADE;
      DROP TABLE IF EXISTS analysis_history CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Recreate users table
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

    // Recreate analysis_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analysis_history (
        id SERIAL PRIMARY KEY,
        ticker VARCHAR(20) NOT NULL,
        signal VARCHAR(10) NOT NULL,
        entry_price DECIMAL(15, 2),
        tp1 DECIMAL(15, 2),
        tp2 DECIMAL(15, 2),
        stop_loss DECIMAL(15, 2),
        highest_price DECIMAL(15, 2),
        lowest_price DECIMAL(15, 2),
        status VARCHAR(20) DEFAULT 'ACTIVE',
        reasoning TEXT,
        date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Recreate watchlist table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS watchlist (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ticker VARCHAR(20) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, ticker)
      )
    `);

    // Recreate price_alerts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS price_alerts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ticker VARCHAR(20) NOT NULL,
        condition VARCHAR(20) NOT NULL CHECK (condition IN ('above', 'below', 'crosses')),
        target_price DECIMAL(15, 2) NOT NULL,
        triggered BOOLEAN DEFAULT FALSE,
        triggered_at TIMESTAMP,
        triggered_price DECIMAL(15, 2),
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Recreate portfolio_transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS portfolio_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ticker VARCHAR(20) NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('BUY', 'SELL')),
        quantity INTEGER NOT NULL,
        price DECIMAL(15, 2) NOT NULL,
        fees DECIMAL(15, 2) DEFAULT 0,
        notes TEXT,
        transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create admin user (Darrell)
    const hashPassword = (password) => {
      const JWT_SECRET = process.env.JWT_SECRET || "moocuan-secret-key-2026";
      let hash = 0;
      const str = password + JWT_SECRET;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return hash.toString(16);
    };

    await pool.query(
      `INSERT INTO users (email, password, name, role, status) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        "darrell.valentino14@gmail.com",
        hashPassword("bebas123"),
        "Darrell Valentino",
        "admin",
        "approved",
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Database reset complete! Admin user created.",
      tables: ["users", "analysis_history", "watchlist", "price_alerts", "portfolio_transactions"],
      admin: {
        email: "darrell.valentino14@gmail.com",
        password: "bebas123",
      },
    });
  } catch (error) {
    console.error("Reset DB Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
