import pool from "./db.js";

// Simple JWT implementation (no external library needed for basic use)
const JWT_SECRET = process.env.JWT_SECRET || "moocuan-secret-key-2026";

// Base64 URL encode/decode
const base64UrlEncode = (str) => {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
};

const base64UrlDecode = (str) => {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString();
};

// Simple HMAC-like signature (for demo purposes - in production use crypto)
const createSignature = (data, secret) => {
  let hash = 0;
  const str = data + secret;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return base64UrlEncode(hash.toString(16));
};

// Create JWT token
export const createToken = (payload) => {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7 days
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = createSignature(`${headerEncoded}.${payloadEncoded}`, JWT_SECRET);

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
};

// Verify JWT token
export const verifyToken = (token) => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerEncoded, payloadEncoded, signature] = parts;
    const expectedSignature = createSignature(`${headerEncoded}.${payloadEncoded}`, JWT_SECRET);

    if (signature !== expectedSignature) return null;

    const payload = JSON.parse(base64UrlDecode(payloadEncoded));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

// Simple password hashing (for demo - use bcrypt in production)
const hashPassword = (password) => {
  let hash = 0;
  const str = password + JWT_SECRET;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
};

// Initialize users table
const initDb = async () => {
  try {
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

    // Create admin user if not exists
    const adminEmail = "darrell.valentino14@gmail.com";
    const adminExists = await pool.query("SELECT id FROM users WHERE email = $1", [adminEmail]);

    if (adminExists.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (email, password, name, role, status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [adminEmail, hashPassword("bebas123"), "Darrell Valentino", "admin", "approved"]
      );
      console.log("Admin user created successfully");
    }
  } catch (error) {
    console.error("Error initializing auth database:", error);
  }
};

// Initialize on module load
initDb();

// Auth API handler
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const path = req.url.split("?")[0].replace("/api/auth", "");

  try {
    // Register
    if (path === "/register" && req.method === "POST") {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ success: false, message: "Semua field harus diisi" });
      }

      // Check if email exists
      const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ success: false, message: "Email sudah terdaftar" });
      }

      // Create user
      const result = await pool.query(
        `INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name, role, status, created_at`,
        [email, hashPassword(password), name]
      );

      const user = result.rows[0];
      return res.status(201).json({
        success: true,
        message: "Registrasi berhasil! Silakan tunggu persetujuan admin.",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          createdAt: user.created_at,
        },
      });
    }

    // Login
    if (path === "/login" && req.method === "POST") {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email dan password harus diisi" });
      }

      const result = await pool.query(
        "SELECT id, email, password, name, role, status, created_at FROM users WHERE email = $1",
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, message: "Email atau password salah" });
      }

      const user = result.rows[0];

      if (user.password !== hashPassword(password)) {
        return res.status(401).json({ success: false, message: "Email atau password salah" });
      }

      if (user.status === "pending") {
        return res.status(403).json({
          success: false,
          message: "Akun Anda belum disetujui. Silakan tunggu persetujuan admin.",
        });
      }

      if (user.status === "rejected") {
        return res.status(403).json({
          success: false,
          message: "Akun Anda ditolak. Silakan hubungi admin.",
        });
      }

      const token = createToken({ userId: user.id, email: user.email, role: user.role });

      return res.json({
        success: true,
        message: "Login berhasil!",
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          createdAt: user.created_at,
        },
      });
    }

    // Verify token
    if (path === "/verify" && req.method === "GET") {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Token tidak ditemukan" });
      }

      const token = authHeader.substring(7);
      const payload = verifyToken(token);

      if (!payload) {
        return res.status(401).json({ success: false, message: "Token tidak valid" });
      }

      const result = await pool.query(
        "SELECT id, email, name, role, status, created_at FROM users WHERE id = $1",
        [payload.userId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, message: "User tidak ditemukan" });
      }

      const user = result.rows[0];
      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          createdAt: user.created_at,
        },
      });
    }

    // Get pending users (admin only)
    if (path === "/pending-users" && req.method === "GET") {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const payload = verifyToken(authHeader.substring(7));
      if (!payload || payload.role !== "admin") {
        return res.status(403).json({ success: false, message: "Akses ditolak" });
      }

      const result = await pool.query(
        "SELECT id, email, name, role, status, created_at FROM users WHERE status = 'pending' ORDER BY created_at DESC"
      );

      return res.json({
        success: true,
        users: result.rows.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          status: u.status,
          createdAt: u.created_at,
        })),
      });
    }

    // Get all users (admin only)
    if (path === "/users" && req.method === "GET") {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const payload = verifyToken(authHeader.substring(7));
      if (!payload || payload.role !== "admin") {
        return res.status(403).json({ success: false, message: "Akses ditolak" });
      }

      const result = await pool.query(
        "SELECT id, email, name, role, status, created_at FROM users ORDER BY created_at DESC"
      );

      return res.json({
        success: true,
        users: result.rows.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          status: u.status,
          createdAt: u.created_at,
        })),
      });
    }

    // Approve user (admin only)
    if (path.startsWith("/approve/") && req.method === "POST") {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const payload = verifyToken(authHeader.substring(7));
      if (!payload || payload.role !== "admin") {
        return res.status(403).json({ success: false, message: "Akses ditolak" });
      }

      const userId = path.split("/")[2];
      await pool.query("UPDATE users SET status = 'approved' WHERE id = $1", [userId]);

      return res.json({ success: true, message: "User berhasil disetujui" });
    }

    // Reject user (admin only)
    if (path.startsWith("/reject/") && req.method === "POST") {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const payload = verifyToken(authHeader.substring(7));
      if (!payload || payload.role !== "admin") {
        return res.status(403).json({ success: false, message: "Akses ditolak" });
      }

      const userId = path.split("/")[2];
      await pool.query("UPDATE users SET status = 'rejected' WHERE id = $1", [userId]);

      return res.json({ success: true, message: "User ditolak" });
    }

    return res.status(404).json({ success: false, message: "Endpoint tidak ditemukan" });
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
