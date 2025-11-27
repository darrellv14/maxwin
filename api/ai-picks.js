import pool from "./db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const limit = parseInt(req.query.limit || "50", 10);

  try {
    // Ambil 1 row terbaru per ticker yang masih ACTIVE dan berasal dari AI Screener
    // Kita filter reasoning yang mengandung "[AI-SCREENER]" agar terpisah dari analisa manual user
    const query = `
      SELECT DISTINCT ON (ticker)
        id,
        ticker,
        signal,
        entry_price,
        tp1,
        tp2,
        stop_loss,
        highest_price,
        lowest_price,
        status,
        reasoning,
        date_created
      FROM analysis_history
      WHERE status = 'ACTIVE' AND reasoning LIKE '[AI-SCREENER]%'
      ORDER BY ticker, date_created DESC
      LIMIT $1
    `;

    const { rows } = await pool.query(query, [limit]);

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate");
    return res.status(200).json(rows);
  } catch (error) {
    console.error("AI Picks API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
