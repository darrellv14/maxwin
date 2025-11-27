import { Pool } from "pg";

const isProd = process.env.NODE_ENV === "production";

if (!globalThis.pgPool) {
  globalThis.pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProd
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
  });
}

const pool = globalThis.pgPool;

export default pool;
