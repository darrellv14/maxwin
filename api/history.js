import pool from "./db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // req.query.limit bisa undefined / string, kita paksa jadi string dulu
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

    // Cache 10 detik (berlaku buat Vercel CDN)
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate");

    return res.status(200).json(rows);
  } catch (error) {
    console.error("History API Error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal error",
    });
  }
}
