
import dotenv from 'dotenv';
const { Pool } = require('pg');
dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
  options: `--search_path=${process.env.DB_SCHEMA || 'public,meditrials'}`,
});
//Optional Listener to check connection
pool.on('connect', () => {
  console.log('PostgreSQL connected successfully');
});

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export { pool };