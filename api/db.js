import { Pool } from "pg";

if (!globalThis.pgPool) {
  globalThis.pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });
}

const pool = globalThis.pgPool;

export default pool;
