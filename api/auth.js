import pool from "./db.js";
import crypto from "crypto";

// =======================
//  CONFIG & CONSTANTS
// =======================

// Pakai SECRET dari env (wajib sama di semua environment)
const JWT_SECRET = process.env.JWT_SECRET || "moocuan-jwt-secret-2024-secure-key";

// Rate limiting store (in-memory, reset setiap deploy)
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 menit

// =======================
//  INPUT VALIDATION
// =======================

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

const sanitizeInput = (input) => {
  if (typeof input !== "string") return "";
  // Remove potential XSS characters and trim
  return input.trim().replace(/[<>'"]/g, "");
};

const isValidPassword = (password) => {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
};

// =======================
//  BASE64 URL HELPERS
// =======================

const base64UrlEncode = (str) => {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const base64UrlDecode = (str) => {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString();
};

// =======================
//  JWT HELPERS
// =======================

// Proper HS256-style signature pakai crypto HMAC
const createSignature = (data) => {
  return crypto
    .createHmac("sha256", JWT_SECRET)
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

// Create JWT token
export const createToken = (payload) => {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7 hari
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = createSignature(`${headerEncoded}.${payloadEncoded}`);

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
};

// Verify JWT token
export const verifyToken = (token) => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerEncoded, payloadEncoded, signature] = parts;
    const expectedSignature = createSignature(`${headerEncoded}.${payloadEncoded}`);

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

// =======================
//  PASSWORD HASHING
// =======================

const hashPassword = (password) => {
  const salt = JWT_SECRET; // simple salt dari secret
  return crypto.createHmac("sha256", salt).update(password).digest("hex");
};

// =======================
//  RATE LIMITING LOGIN
// =======================

const checkRateLimit = (email) => {
  const now = Date.now();
  const attempts = loginAttempts.get(email);

  if (!attempts) {
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }

  // Reset jika lockout time lewat
  if (now - attempts.lastAttempt > LOCKOUT_TIME) {
    loginAttempts.delete(email);
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }

  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const timeLeft = Math.ceil((LOCKOUT_TIME - (now - attempts.lastAttempt)) / 60000);
    return { allowed: false, timeLeft };
  }

  return {
    allowed: true,
    remainingAttempts: MAX_LOGIN_ATTEMPTS - attempts.count,
  };
};

const recordLoginAttempt = (email, success) => {
  if (success) {
    loginAttempts.delete(email);
    return;
  }

  const attempts = loginAttempts.get(email) || { count: 0, lastAttempt: 0 };
  loginAttempts.set(email, {
    count: attempts.count + 1,
    lastAttempt: Date.now(),
  });
};

// =======================
//  INIT DB & SEED ADMIN
// =======================

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

    const adminEmail = "darrell.valentino14@gmail.com";
    const adminExists = await pool.query("SELECT id FROM users WHERE email = $1", [adminEmail]);

    if (adminExists.rows.length === 0) {
      await pool.query(
        `
        INSERT INTO users (email, password, name, role, status)
        VALUES ($1, $2, $3, $4, $5)
      `,
        [adminEmail, hashPassword("bebas123"), "Darrell Valentino", "admin", "approved"]
      );
      console.log("Admin user created successfully");
    }
  } catch (error) {
    console.error("Error initializing auth database:", error);
  }
};

initDb();

// =======================
//  MAIN AUTH HANDLER
// =======================

export default async function handler(req, res) {
  // Security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const path = req.url.split("?")[0].replace("/api/auth", "");

  try {
    // =======================
    //  REGISTER
    // =======================
    if (path === "/register" && req.method === "POST") {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ success: false, message: "Semua field harus diisi" });
      }

      const sanitizedEmail = sanitizeInput(email).toLowerCase();
      const sanitizedName = sanitizeInput(name);

      if (!isValidEmail(sanitizedEmail)) {
        return res.status(400).json({ success: false, message: "Format email tidak valid" });
      }

      if (!isValidPassword(password)) {
        return res.status(400).json({
          success: false,
          message: "Password harus 8-128 karakter",
        });
      }

      if (sanitizedName.length < 2 || sanitizedName.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Nama harus 2-100 karakter",
        });
      }

      const existing = await pool.query("SELECT id FROM users WHERE email = $1", [sanitizedEmail]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ success: false, message: "Email sudah terdaftar" });
      }

      const result = await pool.query(
        `
        INSERT INTO users (email, password, name)
        VALUES ($1, $2, $3)
        RETURNING id, email, name, role, status, created_at
      `,
        [sanitizedEmail, hashPassword(password), sanitizedName]
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

    // =======================
    //  LOGIN
    // =======================
    if (path === "/login" && req.method === "POST") {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email dan password harus diisi",
        });
      }

      const sanitizedEmail = sanitizeInput(email).toLowerCase();

      // Rate limit check
      const rateLimit = checkRateLimit(sanitizedEmail);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          message: `Terlalu banyak percobaan login. Coba lagi dalam ${rateLimit.timeLeft} menit.`,
        });
      }

      const result = await pool.query(
        `
        SELECT id, email, password, name, role, status, created_at
        FROM users
        WHERE email = $1
      `,
        [sanitizedEmail]
      );

      if (result.rows.length === 0) {
        recordLoginAttempt(sanitizedEmail, false);
        return res.status(401).json({
          success: false,
          message: "Email atau password salah",
        });
      }

      const user = result.rows[0];

      if (user.password !== hashPassword(password)) {
        recordLoginAttempt(sanitizedEmail, false);
        return res.status(401).json({
          success: false,
          message: "Email atau password salah",
        });
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

      recordLoginAttempt(sanitizedEmail, true);

      const token = createToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

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

    // =======================
    //  CHANGE PASSWORD
    // =======================
    if (path === "/change-password" && req.method === "POST") {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      const payload = verifyToken(token);

      if (!payload || !payload.userId) {
        return res.status(401).json({ success: false, message: "Token tidak valid" });
      }

      const { currentPassword, newPassword, confirmPassword } = req.body || {};

      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "Password lama, baru, dan konfirmasi harus diisi",
        });
      }

      if (!isValidPassword(newPassword)) {
        return res.status(400).json({
          success: false,
          message: "Password baru harus 8-128 karakter",
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "Konfirmasi password baru tidak sesuai",
        });
      }

      if (currentPassword === newPassword) {
        return res.status(400).json({
          success: false,
          message: "Password baru tidak boleh sama dengan password lama",
        });
      }

      const result = await pool.query(
        `
        SELECT id, password
        FROM users
        WHERE id = $1
      `,
        [payload.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: "User tidak ditemukan" });
      }

      const user = result.rows[0];

      if (user.password !== hashPassword(currentPassword)) {
        return res.status(400).json({
          success: false,
          message: "Password lama tidak sesuai",
        });
      }

      const newHash = hashPassword(newPassword);
      await pool.query("UPDATE users SET password = $1 WHERE id = $2", [newHash, user.id]);

      return res.json({
        success: true,
        message: "Password berhasil diubah",
      });
    }

    // =======================
    //  VERIFY TOKEN
    // =======================
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
        `
        SELECT id, email, name, role, status, created_at
        FROM users
        WHERE id = $1
      `,
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

    // =======================
    //  ADMIN: PENDING USERS
    // =======================
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
        `
        SELECT id, email, name, role, status, created_at
        FROM users
        WHERE status = 'pending'
        ORDER BY created_at DESC
      `
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

    // =======================
    //  ADMIN: ALL USERS
    // =======================
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
        `
        SELECT id, email, name, role, status, created_at
        FROM users
        ORDER BY created_at DESC
      `
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

    // =======================
    //  ADMIN: APPROVE USER
    // =======================
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

    // =======================
    //  ADMIN: REJECT USER
    // =======================
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

    // Fallback
    return res.status(404).json({ success: false, message: "Endpoint tidak ditemukan" });
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
