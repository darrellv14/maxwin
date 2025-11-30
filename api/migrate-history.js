import pool from "./db.js";

/**
 * Migration Script: Add user_id to analysis_history
 * 
 * This script:
 * 1. Drops the existing analysis_history table
 * 2. Recreates it with user_id foreign key
 * 3. Makes history unique per user
 * 
 * ⚠️ WARNING: This will DELETE ALL existing history data!
 * Run this ONLY after backing up important data.
 */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("🗑️  Dropping old analysis_history table...");
    await pool.query(`DROP TABLE IF EXISTS analysis_history CASCADE`);

    console.log("✨ Creating new analysis_history table with user_id...");
    await pool.query(`
      CREATE TABLE analysis_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
        date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, ticker, date_created)
      )
    `);

    console.log("✅ Migration complete!");
    
    return res.status(200).json({
      success: true,
      message: "analysis_history table migrated successfully with user_id",
      next_steps: [
        "Truncate data in Supabase using SQL Editor:",
        "TRUNCATE TABLE analysis_history RESTART IDENTITY CASCADE;",
        "Update history.js to use authenticated user_id",
        "Test saving and fetching history per user"
      ]
    });
  } catch (error) {
    console.error("❌ Migration failed:", error);
    return res.status(500).json({
      error: "Migration failed",
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
