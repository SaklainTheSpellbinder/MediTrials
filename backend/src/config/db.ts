
import dotenv from 'dotenv';
const { Pool } = require('pg');
// 1. Load the .env file
dotenv.config();

// 2. Create the connection pool configuration
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

// 3. Optional: Add a listener to confirm connection in console
pool.on('connect', () => {
  console.log('🐘 PostgreSQL connected successfully');
});

pool.on('error', (err:Error) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// 4. Export the pool to be used in other files
export { pool };