const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'meditrials',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function test() {
    try {
        console.log("Checking adverse_events for patient 7...");
        const aeRes = await pool.query('SELECT * FROM adverse_events WHERE patient_id = 7');
        console.log("AEs:", aeRes.rows);

        console.log("Checking safety_alerts for patient 7...");
        const alertRes = await pool.query('SELECT * FROM safety_alerts WHERE patient_id = 7');
        console.log("Alerts:", alertRes.rows);

        console.log("Checking protocol_deviations for patient 7...");
        const pdRes = await pool.query('SELECT * FROM protocol_deviations WHERE patient_id = 7');
        console.log("Deviations:", pdRes.rows);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
test();
