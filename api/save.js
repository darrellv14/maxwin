import pool from "./db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { ticker, signal, entry_price, tp1, tp2, stop_loss, reasoning } = req.body || {};

  // Validasi minimal (boleh dihapus kalau nggak perlu)
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
