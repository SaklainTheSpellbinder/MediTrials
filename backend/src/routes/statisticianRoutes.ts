import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../config/db';

const router = Router();

// ── Auth helpers ─────────────────────────────────────────────────────────────
function decodeUser(req: Request): any | null {
    const header = req.headers['x-user-data'];
    if (!header) return null;
    try { return JSON.parse(Buffer.from(header as string, 'base64').toString('utf8')); }
    catch { return null; }
}

// Inject user on every request (non-blocking)
router.use((req: Request, _res: Response, next) => {
    (req as any).user = decodeUser(req);
    next();
});

const requireStatistician = (req: Request, res: Response, next: any) => {
    const u = (req as any).user;
    if (!u) return res.status(401).json({ error: 'Unauthorized' });
    if (u.role !== 'Statistician') return res.status(403).json({ error: 'Forbidden — Statistician only' });
    next();
};

// ── GET /api/dashboard/statistician ──────────────────────────────────────────
router.get('/statistician', requireStatistician, async (req: Request, res: Response) => {
    try {
        const [datasets, survival, locks, enrollmentFull, populations, ppCount, firstTrial, balance] =
            await Promise.all([
                // Step 1: Analysis datasets
                pool.query(`
                    SELECT ad.dataset_id, ad.dataset_name, ad.dataset_type, ad.snapshot_date,
                           ad.data_cutoff_date, ad.population_count, ad.p_value, ad.statistical_significance,
                           ct.trial_title
                    FROM public.analysis_datasets ad
                    JOIN public.clinical_trials ct ON ct.trial_id = ad.trial_id
                    ORDER BY ad.snapshot_date DESC
                `),
                // Step 2: Recent survival analyses
                pool.query(`
                    SELECT sa.analysis_id, ct.trial_title, sa.endpoint_type, sa.hazard_ratio,
                           sa.logrank_p_value, sa.confidence_interval_95, sa.calculated_at
                    FROM public.survival_analysis sa
                    JOIN public.clinical_trials ct ON ct.trial_id = sa.trial_id
                    ORDER BY sa.calculated_at DESC LIMIT 5
                `),
                // Step 3: Active data locks
                pool.query(`
                    SELECT dl.lock_id, ct.trial_title, dl.lock_type, dl.lock_date, dl.snapshot_hash
                    FROM public.data_locks dl
                    JOIN public.clinical_trials ct ON ct.trial_id = dl.trial_id
                    WHERE dl.unlock_date IS NULL
                    ORDER BY dl.lock_date DESC
                `),
                // Step 4: Enrollment per trial — USE mv_site_enrollment aggregated by trial
                pool.query(`
                    SELECT ct.trial_id, ct.trial_title, ct.trial_phase, ct.trial_status,
                           ct.target_enrollment,
                           COALESCE(SUM(mse.current_enrollment), 0) AS current_enrollment,
                           COALESCE(ROUND(SUM(mse.current_enrollment)::DECIMAL / NULLIF(ct.target_enrollment,0) * 100, 1), 0) AS enrollment_pct
                    FROM public.clinical_trials ct
                    LEFT JOIN public.mv_site_enrollment mse ON mse.trial_id = ct.trial_id
                    GROUP BY ct.trial_id, ct.trial_title, ct.trial_phase, ct.trial_status, ct.target_enrollment
                    ORDER BY ct.trial_id
                `),
                // Step 5: ITT population
                pool.query(`
                    SELECT COUNT(*) FILTER (WHERE patient_status IN ('Enrolled','Active','Completed')) AS itt_population
                    FROM public.patients
                `),
                // Step 5b: Per-protocol (excludes Major/Critical deviations)
                pool.query(`
                    SELECT COUNT(DISTINCT p.patient_id) AS per_protocol
                    FROM public.patients p
                    WHERE p.patient_status IN ('Active','Completed')
                      AND NOT EXISTS (
                          SELECT 1 FROM public.protocol_deviations pd
                          WHERE pd.patient_id = p.patient_id
                            AND pd.deviation_type IN ('Major','Critical')
                      )
                `),
                // Step 6: First active trial for power estimate
                pool.query(`
                    SELECT trial_id FROM public.clinical_trials
                    WHERE trial_status IN ('Active','Recruiting') ORDER BY trial_id LIMIT 1
                `),
                // Step 7: Randomization balance — USE mv_randomization_balance directly
                pool.query(`
                    SELECT trial_id, trial_title, arm_code, patient_count, avg_age, male_count, female_count, pct_male
                    FROM public.mv_randomization_balance
                    ORDER BY trial_id, arm_code
                `),
            ]);

        // Step 6b: Power estimate for first active trial
        let latestPowerEstimate = null;
        if (firstTrial.rows.length > 0) {
            try {
                const { rows: pr } = await pool.query(`
                    SELECT required_sample_size, current_power
                    FROM (CALL public.sp_calculate_power_analysis($1, 0.5, 0.05, 0.8, NULL, NULL)) AS r
                `, [firstTrial.rows[0].trial_id]);
                if (pr.length > 0 && pr[0].required_sample_size != null) {
                    latestPowerEstimate = {
                        trialId: firstTrial.rows[0].trial_id,
                        requiredSampleSize: pr[0].required_sample_size,
                        currentPower: parseFloat(pr[0].current_power),
                    };
                }
            } catch (e) {
                // Power analysis may fail if insufficient data — non-fatal
                console.warn('Power estimate skipped:', (e as any).message);
            }
        }

        res.json({
            analysisDatasets: datasets.rows,
            recentSurvivalAnalyses: survival.rows,
            activeLocks: locks.rows,
            enrollmentByTrial: enrollmentFull.rows,
            ittPopulation: parseInt(populations.rows[0].itt_population),
            perProtocolPopulation: parseInt(ppCount.rows[0].per_protocol),
            latestPowerEstimate,
            randomizationBalance: balance.rows,
        });
    } catch (err: any) {
        console.error('Statistician dashboard error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/statistics/datasets ─────────────────────────────────────────────
router.get('/datasets', async (_req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT ad.*, ct.trial_title
            FROM public.analysis_datasets ad
            JOIN public.clinical_trials ct ON ct.trial_id = ad.trial_id
            ORDER BY ad.snapshot_date DESC
        `);
        res.json(rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/statistics/datasets/generate ───────────────────────────────────
router.post('/datasets/generate', async (req: Request, res: Response) => {
    const { trial_id, dataset_type, data_cutoff_date } = req.body;
    if (!trial_id || !dataset_type) return res.status(400).json({ error: 'trial_id and dataset_type required' });
    try {
        const { rows } = await pool.query(`
            SELECT csdr_report FROM (CALL public.sp_generate_csdr($1, NULL)) AS r
        `, [trial_id]);
        const csdrReport = rows[0]?.csdr_report;

        const { rows: inserted } = await pool.query(`
            INSERT INTO public.analysis_datasets
                (trial_id, dataset_name, dataset_type, snapshot_date, data_cutoff_date,
                 population_count, analysis_results)
            VALUES ($1, $2, $3, CURRENT_DATE, $4,
                    ($5::jsonb->'patient_accountability'->>'enrolled')::INT, $5)
            RETURNING *
        `, [trial_id, `${dataset_type} - ${data_cutoff_date}`, dataset_type, data_cutoff_date, JSON.stringify(csdrReport)]);

        res.status(201).json(inserted[0]);
    } catch (err: any) {
        console.error('Generate dataset error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/statistics/survival ─────────────────────────────────────────────
router.get('/survival', async (req: Request, res: Response) => {
    const { trial_id } = req.query;
    if (!trial_id) return res.status(400).json({ error: 'trial_id required' });
    try {
        const { rows } = await pool.query(`
            SELECT sa.*, ct.trial_title FROM public.survival_analysis sa
            JOIN public.clinical_trials ct ON ct.trial_id = sa.trial_id
            WHERE sa.trial_id = $1 ORDER BY sa.calculated_at DESC
        `, [trial_id]);
        res.json(rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/statistics/survival/calculate ───────────────────────────────────
router.post('/survival/calculate', async (req: Request, res: Response) => {
    const { trial_id, endpoint_type } = req.body;
    if (!trial_id || !endpoint_type) return res.status(400).json({ error: 'trial_id and endpoint_type required' });
    try {
        await pool.query(`CALL public.sp_calculate_survival($1, $2)`, [trial_id, endpoint_type]);
        const { rows } = await pool.query(`
            SELECT * FROM public.survival_analysis
            WHERE trial_id = $1 AND endpoint_type = $2
            ORDER BY calculated_at DESC LIMIT 1
        `, [trial_id, endpoint_type]);
        res.json(rows[0]);
    } catch (err: any) {
        console.error('Survival calc error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/statistics/power ────────────────────────────────────────────────
router.post('/power', async (req: Request, res: Response) => {
    const { trial_id, effect_size = 0.5, alpha = 0.05, power_target = 0.8 } = req.body;
    if (!trial_id) return res.status(400).json({ error: 'trial_id required' });
    try {
        const { rows } = await pool.query(`
            SELECT required_sample_size, current_power
            FROM (CALL public.sp_calculate_power_analysis($1, $2, $3, $4, NULL, NULL)) AS r
        `, [trial_id, effect_size, alpha, power_target]);
        res.json({ requiredSampleSize: rows[0].required_sample_size, currentPower: parseFloat(rows[0].current_power) });
    } catch (err: any) {
        console.error('Power calc error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/statistics/balance ───────────────────────────────────────────────
router.get('/balance', async (req: Request, res: Response) => {
    const { trial_id } = req.query;
    try {
        const q = trial_id
            ? await pool.query(`SELECT * FROM public.mv_randomization_balance WHERE trial_id = $1 ORDER BY arm_code`, [trial_id])
            : await pool.query(`SELECT * FROM public.mv_randomization_balance ORDER BY trial_id, arm_code`);
        res.json(q.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/statistics/ae-incidence ──────────────────────────────────────────
router.get('/ae-incidence', async (req: Request, res: Response) => {
    const { trial_id } = req.query;
    if (!trial_id) return res.status(400).json({ error: 'trial_id required' });
    try {
        const { rows } = await pool.query(
            `SELECT * FROM public.mv_ae_by_arm WHERE trial_id = $1 ORDER BY arm_code`,
            [trial_id]
        );
        res.json(rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/export/sdtm (shared with DM) ────────────────────────────────────
router.get('/export/sdtm', async (req: Request, res: Response) => {
    const { trial_id, domains = 'DM,AE,VS,LB' } = req.query;
    if (!trial_id) return res.status(400).json({ error: 'trial_id required' });
    try {
        const { rows } = await pool.query(`
            SELECT dm_data, ae_data, vs_data, lb_data
            FROM (CALL public.sp_export_cdisc_sdtm($1, NULL, NULL, NULL, NULL)) AS r
        `, [trial_id]);
        const requested = (domains as string).split(',').map(d => d.trim().toLowerCase());
        const result: Record<string, any> = {};
        if (requested.includes('dm')) result.DM = rows[0]?.dm_data;
        if (requested.includes('ae')) result.AE = rows[0]?.ae_data;
        if (requested.includes('vs')) result.VS = rows[0]?.vs_data;
        if (requested.includes('lb')) result.LB = rows[0]?.lb_data;
        res.setHeader('Content-Type', 'application/json');
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
