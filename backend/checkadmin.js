const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function run() {
    try {
        const r = await pool.query(`
      SELECT table_name, column_name
      FROM information_schema.columns 
      WHERE table_schema = 'meditrials'
      AND table_name IN ('mv_safety_overview','failed_login_attempts','users','safety_alerts')
      ORDER BY table_name, ordinal_position
    `);
        let cur = '';
        for (const row of r.rows) {
            if (row.table_name !== cur) { cur = row.table_name; console.log('\n' + cur + ':'); }
            console.log('  ' + row.column_name);
        }
        // Also check if users has failed_login_attempts
        const u = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='meditrials' AND table_name='users' ORDER BY ordinal_position`);
        console.log('\nusers columns:');
        u.rows.forEach(r => console.log('  ' + r.column_name));
        // mv_safety_overview
        const mv = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='meditrials' AND table_name='mv_safety_overview' ORDER BY ordinal_position`);
        console.log('\nmv_safety_overview:');
        mv.rows.forEach(r => console.log('  ' + r.column_name));
        // safety_alerts  
        const sa = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='meditrials' AND table_name='safety_alerts' ORDER BY ordinal_position`);
        console.log('\nsafety_alerts:');
        sa.rows.forEach(r => console.log('  ' + r.column_name));
    } catch (e) { console.error(e.message); }
    pool.end();
}
run();
