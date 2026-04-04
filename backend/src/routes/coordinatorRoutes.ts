import { Router } from 'express';
import { pool } from '../config/db';
import fs from 'fs';
import path from 'path';
import { requireRole } from '../middleware/authMiddleware';
import type { Request, Response } from 'express';
import '../middleware/authMiddleware';

const router = Router();
router.use(requireRole(['Study_Coordinator']));

async function auditLog(
    client: any, 
    tableName: string, 
    recordId: number, 
    action: string, 
    newValues: any, 
    userId: number | null | undefined, 
    reason: string
) {
    try {
        await client.query(`
            INSERT INTO public.audit_trail_21cfr
                (table_name, record_id, column_name, action_type, new_value, changed_by_user_id, change_reason, ip_address, data_hash)
            VALUES (
                $1::VARCHAR, 
                $2::INTEGER, 
                $3::VARCHAR, 
                $4::VARCHAR, 
                $5::JSONB, 
                $6::INTEGER, 
                $7::TEXT,
                COALESCE(inet_client_addr()::TEXT, '127.0.0.1'),
                md5(COALESCE(($5::JSONB)::TEXT, '') || $4::VARCHAR || $1::VARCHAR || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::TEXT)
            )
        `, [
            tableName, 
            recordId, 
            '__json__', 
            action, 
            JSON.stringify(newValues), 
            userId || null,
            reason
        ]);
    } catch (e: any) {
        console.warn('audit log warning:', e.message);
        throw new Error(`Audit Log Failed: ${e.message}`);
    }
}

const queriesDir = path.join(__dirname, '../../../database/study_coordinator_queries');
const getQuery = (filename: string) => fs.readFileSync(path.join(queriesDir, filename), 'utf8');

// GET /api/coordinator/stats
router.get('/stats', async (req, res) => {
    try {
        const siteId = req.user?.site_id; 
        if (!siteId) return res.status(403).json({ error: 'User is not assigned to a site' });

        const query = getQuery('002_get_coordinator_stats.sql');
        const result = await pool.query(query, [siteId]);
        const stats = result.rows[0] || {};
        
        res.json({
            today_visits: parseInt(stats.today_visits || '0'),
            pending_labs: parseInt(stats.pending_labs || '0'),
            incomplete_ecrfs: parseInt(stats.incomplete_ecrfs || '0'),
            open_queries: parseInt(stats.open_queries || '0')
        });
    } catch (err: any) {
        console.error('Coordinator Stats Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /api/coordinator/visits/today
router.get('/visits/today', async (req, res) => {
    try {
        const siteId = req.user?.site_id;
        if (!siteId) return res.status(403).json({ error: 'User is not assigned to a site' });

        const query = getQuery('001_get_todays_visits.sql');
        const result = await pool.query(query, [siteId]);
        res.json(result.rows);
    } catch (err: any) {
        console.error('Coordinator Visits Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /api/coordinator/labs/pending
router.get('/labs/pending', async (req, res) => {
    try {
        const siteId = req.user?.site_id;
        if (!siteId) return res.status(403).json({ error: 'User is not assigned to a site' });

        const query = getQuery('003_get_pending_labs.sql');
        const result = await pool.query(query, [siteId]);
        res.json(result.rows);
    } catch (err: any) {
        console.error('Coordinator Labs Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// POST /api/coordinator/labs/update
router.post('/labs/update', async (req: Request, res: Response) => {
    const { result_id, result_value, change_reason } = req.body;
    
    if (!result_id || result_value === undefined) {
        return res.status(400).json({ error: 'Missing result_id or result_value' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        // 1. Update the lab result
        const query = getQuery('004_update_lab_result.sql');
        const result = await client.query(query, [result_value, result_id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Lab result not found' });
        }

        // 2. Insert Audit Log
        const reason = change_reason || 'Lab result updated by coordinator';
        await auditLog(client, 'lab_results', result_id, 'UPDATE', { result_value }, req.user?.user_id, reason);

        await client.query('COMMIT');
        res.json({ message: 'Lab result updated successfully', data: result.rows[0] });

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Update Lab Error:', err);
        res.status(500).json({ error: err.message || 'Server Error' });
    } finally {
        client.release();
    }
});

// POST /api/coordinator/visits/checkin
router.post('/visits/checkin', async (req: Request, res: Response) => {
    const { visit_instance_id, change_reason } = req.body;
    
    if (!visit_instance_id) {
        return res.status(400).json({ error: 'Missing visit_instance_id' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Update visit check-in status
        const query = getQuery('005_update_visit_checkin.sql');
        const result = await client.query(query, [visit_instance_id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Visit not found' });
        }

        // 2. Insert Audit Log
        const reason = change_reason || 'Patient checked in for visit';
        await auditLog(client, 'visit_instances', visit_instance_id, 'UPDATE', { status: 'Checked-In' }, req.user?.user_id, reason);

        await client.query('COMMIT');
        res.json({ message: 'Patient checked in successfully', data: result.rows[0] });

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Check-In Error:', err);
        res.status(500).json({ error: err.message || 'Server Error' });
    } finally {
        client.release();
    }
});

export default router;