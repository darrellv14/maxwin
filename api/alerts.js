import pool from "./db.js";
import { verifyToken } from "./auth.js";
import { setSecurityHeaders, sanitizeInput } from "./security.js";

// Initialize alerts table
const initDb = async () => {
  try {
    // Ensure users table exists first
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
  } catch (error) {
    console.error("Error initializing alerts table:", error);
  }
};

initDb().catch(console.error);

// ============ CHECK ALERTS (cron) ============
async function checkAlerts(req, res) {
  try {
    const alertsResult = await pool.query(`
      SELECT DISTINCT ticker FROM price_alerts 
      WHERE active = TRUE AND triggered = FALSE
    `);

    const tickers = alertsResult.rows.map((r) => r.ticker);
    
    if (tickers.length === 0) {
      return res.json({ success: true, message: "No active alerts to check", triggered: 0 });
    }

    let triggeredCount = 0;

    for (const ticker of tickers) {
      try {
        const priceResponse = await fetch(
          `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/live?ticker=${ticker}`
        );
        
        if (!priceResponse.ok) continue;
        
        const priceData = await priceResponse.json();
        const currentPrice = priceData.price;
        
        if (!currentPrice) continue;

        const tickerAlerts = await pool.query(
          `SELECT id, user_id, condition, target_price 
           FROM price_alerts 
           WHERE ticker = $1 AND active = TRUE AND triggered = FALSE`,
          [ticker]
        );

        for (const alert of tickerAlerts.rows) {
          const targetPrice = parseFloat(alert.target_price);
          let shouldTrigger = false;

          switch (alert.condition) {
            case "above":
              shouldTrigger = currentPrice >= targetPrice;
              break;
            case "below":
              shouldTrigger = currentPrice <= targetPrice;
              break;
            case "crosses":
              shouldTrigger = Math.abs(currentPrice - targetPrice) / targetPrice < 0.01;
              break;
          }

          if (shouldTrigger) {
            await pool.query(
              `UPDATE price_alerts 
               SET triggered = TRUE, triggered_at = CURRENT_TIMESTAMP, triggered_price = $1
               WHERE id = $2`,
              [currentPrice, alert.id]
            );
            triggeredCount++;
            console.log(`Alert triggered: ${ticker} ${alert.condition} ${targetPrice} (current: ${currentPrice})`);
          }
        }
      } catch (tickerError) {
        console.error(`Error checking ticker ${ticker}:`, tickerError);
      }
    }

    return res.json({
      success: true,
      message: `Checked ${tickers.length} tickers`,
      triggered: triggeredCount,
    });
  } catch (error) {
    console.error("Check alerts error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ============ MAIN HANDLER ============
export default async function handler(req, res) {
  setSecurityHeaders(res);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const path = req.url.split("?")[0].replace("/api/alerts", "");

  // Route: /api/alerts/check (cron job - no auth needed)
  if (path === "/check") {
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }
    return checkAlerts(req, res);
  }

  // All other routes require authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const payload = verifyToken(authHeader.substring(7));
  if (!payload) {
    return res.status(401).json({ success: false, message: "Token tidak valid" });
  }

  const userId = payload.userId;

  try {
    // GET - Get all alerts
    if (req.method === "GET" && (path === "" || path === "/")) {
      const activeOnly = req.query?.active === "true";
      
      let query = `
        SELECT id, ticker, condition, target_price, triggered, triggered_at, 
               triggered_price, active, created_at 
        FROM price_alerts 
        WHERE user_id = $1
      `;
      
      if (activeOnly) {
        query += " AND active = TRUE AND triggered = FALSE";
      }
      
      query += " ORDER BY created_at DESC";

      const result = await pool.query(query, [userId]);

      return res.json({
        success: true,
        alerts: result.rows.map((a) => ({
          id: a.id,
          ticker: a.ticker,
          condition: a.condition,
          targetPrice: parseFloat(a.target_price),
          triggered: a.triggered,
          triggeredAt: a.triggered_at,
          triggeredPrice: a.triggered_price ? parseFloat(a.triggered_price) : null,
          active: a.active,
          createdAt: a.created_at,
        })),
      });
    }

    // POST - Create new alert
    if (req.method === "POST" && (path === "" || path === "/")) {
      const { ticker, condition, targetPrice } = req.body;

      if (!ticker || !condition || !targetPrice) {
        return res.status(400).json({
          success: false,
          message: "Ticker, condition, dan targetPrice harus diisi",
        });
      }

      if (!["above", "below", "crosses"].includes(condition)) {
        return res.status(400).json({
          success: false,
          message: "Condition harus 'above', 'below', atau 'crosses'",
        });
      }

      const normalizedTicker = ticker.toUpperCase();

      const countResult = await pool.query(
        "SELECT COUNT(*) FROM price_alerts WHERE user_id = $1 AND active = TRUE",
        [userId]
      );
      
      if (parseInt(countResult.rows[0].count) >= 20) {
        return res.status(400).json({
          success: false,
          message: "Maksimal 20 alert aktif per user",
        });
      }

      const result = await pool.query(
        `INSERT INTO price_alerts (user_id, ticker, condition, target_price)
         VALUES ($1, $2, $3, $4)
         RETURNING id, ticker, condition, target_price, created_at`,
        [userId, normalizedTicker, condition, targetPrice]
      );

      const alert = result.rows[0];
      return res.status(201).json({
        success: true,
        message: "Alert berhasil dibuat",
        alert: {
          id: alert.id,
          ticker: alert.ticker,
          condition: alert.condition,
          targetPrice: parseFloat(alert.target_price),
          createdAt: alert.created_at,
        },
      });
    }

    // DELETE /:id - Delete an alert
    if (req.method === "DELETE" && path.match(/^\/\d+$/)) {
      const alertId = path.substring(1);

      const result = await pool.query(
        "DELETE FROM price_alerts WHERE id = $1 AND user_id = $2 RETURNING id",
        [alertId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Alert tidak ditemukan" });
      }

      return res.json({ success: true, message: "Alert berhasil dihapus" });
    }

    // PUT /:id/deactivate - Deactivate an alert
    if (req.method === "PUT" && path.match(/^\/\d+\/deactivate$/)) {
      const alertId = path.split("/")[1];

      await pool.query(
        "UPDATE price_alerts SET active = FALSE WHERE id = $1 AND user_id = $2",
        [alertId, userId]
      );

      return res.json({ success: true, message: "Alert dinonaktifkan" });
    }

    return res.status(404).json({ success: false, message: "Endpoint tidak ditemukan" });
  } catch (error) {
    console.error("Alerts error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
