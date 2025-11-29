import fs from 'fs';
import path from 'path';

// Load .env BEFORE importing db
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    line = line.replace(/\r/g, ''); // Remove Windows carriage return
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
  console.log('.env loaded');
}

console.log('DATABASE_URL:', process.env.DATABASE_URL);

// Dynamic import AFTER env is loaded
const { default: pool } = await import('./api/db.js');

async function test() {
  try {
    console.log('Testing database connection...');
    const result = await pool.query('SELECT 1 as test');
    console.log('DB Connection OK:', result.rows);

    // Check if users table exists
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables:', tables.rows.map(r => r.table_name));

    // Check for admin user
    const users = await pool.query('SELECT id, email, role, status FROM users LIMIT 5');
    console.log('Users:', users.rows);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

test();
