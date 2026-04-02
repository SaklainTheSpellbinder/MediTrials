require('dotenv').config();
const { pool } = require('./src/config/db');
const fs = require('fs');

async function run() {
    try {
        const sql = fs.readFileSync('../database/study_coordinator_queries/006_fix_visit_status_constraint.sql', 'utf8');
        await pool.query(sql);
        console.log('Fixed DB constraint');
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
