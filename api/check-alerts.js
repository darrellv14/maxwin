import pool from "./db.js";

// This endpoint is called by a cron job to check and trigger alerts
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    // Get all active, non-triggered alerts
    const alertsResult = await pool.query(`
      SELECT DISTINCT ticker FROM price_alerts 
      WHERE active = TRUE AND triggered = FALSE
    `);

    const tickers = alertsResult.rows.map((r) => r.ticker);
    
    if (tickers.length === 0) {
      return res.json({ success: true, message: "No active alerts to check", triggered: 0 });
    }

    let triggeredCount = 0;

    // Check each ticker's current price
    for (const ticker of tickers) {
      try {
        // Fetch current price from our live API
        const priceResponse = await fetch(
          `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/live?ticker=${ticker}`
        );
        
        if (!priceResponse.ok) continue;
        
        const priceData = await priceResponse.json();
        const currentPrice = priceData.price;
        
        if (!currentPrice) continue;

        // Get alerts for this ticker
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
              // For crosses, we'd need to track previous price - simplified here
              shouldTrigger = Math.abs(currentPrice - targetPrice) / targetPrice < 0.01; // Within 1%
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

            // Here you could add email/push notification logic
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
