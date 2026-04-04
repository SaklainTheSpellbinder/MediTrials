import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../config/db';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();
router.use(requireRole(['Statistician']));

// GET /api/dashboard/statistician — dashboard data aggregation
router.get('/statistician', async (req: Request, res: Response) => {
    try {
        const [datasets, survival, locks, enrollmentFull, populations, ppCount, firstTrial, balance] =
            await Promise.all([
                // Analysis datasets (most recent first)
                pool.query(`
                    SELECT ad.dataset_id, ad.dataset_name, ad.dataset_type, ad.snapshot_date,
                           ad.data_cutoff_date, ad.population_count, ad.p_value, ad.statistical_significance,
                           ct.trial_title
                    FROM public.analysis_datasets ad
                    JOIN public.clinical_trials ct ON ct.trial_id = ad.trial_id
                    ORDER BY ad.snapshot_date DESC
                `),
                // Recent survival analyses
                pool.query(`
                    SELECT sa.analysis_id, ct.trial_title, sa.endpoint_type, sa.hazard_ratio,
                           sa.logrank_p_value, sa.confidence_interval_95, sa.calculated_at
                    FROM public.survival_analysis sa
                    JOIN public.clinical_trials ct ON ct.trial_id = sa.trial_id
                    ORDER BY sa.calculated_at DESC LIMIT 5
                `),
                // Active data locks
                pool.query(`
                    SELECT dl.lock_id, ct.trial_title, dl.lock_type, dl.lock_date, dl.snapshot_hash
                    FROM public.data_locks dl
                    JOIN public.clinical_trials ct ON ct.trial_id = dl.trial_id
                    WHERE dl.unlock_date IS NULL
                    ORDER BY dl.lock_date DESC
                `),
                // Enrollment by trial using mv_site_enrollment
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
                // ITT population count
                pool.query(`
                    SELECT COUNT(*) FILTER (WHERE patient_status IN ('Enrolled','Active','Completed')) AS itt_population
                    FROM public.patients
                `),
                // Per-protocol population (exclude major/critical deviations)
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
                // First active trial for power estimate
                pool.query(`
                    SELECT trial_id FROM public.clinical_trials
                    WHERE trial_status IN ('Active','Recruiting') ORDER BY trial_id LIMIT 1
                `),
                // Randomization balance from materialized view
                pool.query(`
                    SELECT trial_id, trial_title, arm_code, patient_count, avg_age, male_count, female_count, pct_male
                    FROM public.mv_randomization_balance
                    ORDER BY trial_id, arm_code
                `),
            ]);

        // Power estimate for first active trial
        let latestPowerEstimate = null;
        if (firstTrial.rows.length > 0) {
            try {
                const { rows: pr } = await pool.query(
                    `CALL public.sp_calculate_power_analysis($1, 0.5, 0.05, 0.8, NULL, NULL)`,
                    [firstTrial.rows[0].trial_id]
                );
                if (pr.length > 0 && pr[0].required_sample_size != null) {
                    latestPowerEstimate = {
                        trialId: firstTrial.rows[0].trial_id,
                        requiredSampleSize: pr[0].required_sample_size,
                        currentPower: parseFloat(pr[0].current_power),
                    };
                }
            } catch (e) {
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


// TRIALS (shared dropdown data)
// GET /api/statistics/trials — list all trials for dropdowns across stat pages
router.get('/trials', async (_req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT trial_id, trial_title, trial_nct_id, trial_phase, trial_status, target_enrollment
            FROM public.clinical_trials
            ORDER BY trial_title
        `);
        res.json(rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// PAGE 1: ANALYSIS DATASETS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/statistics/datasets?trialId=X — enriched dataset list with trial info
router.get('/datasets', async (req: Request, res: Response) => {
    const { trialId } = req.query;
    try {
        // Enriched dataset list: include trial info and full analysis_results JSONB
        const { rows } = await pool.query(`
            SELECT
                ad.dataset_id,
                ad.dataset_name,
                ad.dataset_type,
                ad.snapshot_date,
                ad.data_cutoff_date,
                ad.population_count,
                ad.p_value,
                ad.statistical_significance,
                ad.analysis_results,
                ad.created_at,
                ct.trial_title,
                ct.trial_nct_id
            FROM public.analysis_datasets ad
            JOIN public.clinical_trials ct ON ct.trial_id = ad.trial_id
            WHERE ($1::INTEGER IS NULL OR ad.trial_id = $1)
            ORDER BY ad.created_at DESC
        `, [trialId || null]);
        res.json(rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/statistics/datasets — create dataset with explicit transaction + sp_generate_csdr
router.post('/datasets', async (req: Request, res: Response) => {
    const { trial_id, dataset_name, dataset_type, data_cutoff_date, population_definition, p_value, statistical_significance } = req.body;
    const u = (req as any).user;
    if (!trial_id || !dataset_name || !dataset_type) {
        return res.status(400).json({ error: 'trial_id, dataset_name, and dataset_type are required' });
    }
    const client = await pool.connect();
    try {
        // Explicit transaction: BEGIN → SET LOCAL session vars → INSERT → CALL → COMMIT
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.current_user_id', $1::text, true)", [(u?.user_id ?? 0).toString()]);
        await client.query("SELECT set_config('app.change_reason', $1::text, true)", ['Statistician created analysis dataset']);

        // Call sp_generate_csdr to produce the analysis_results JSONB
        let csdrReport: any = null;
        try {
            const { rows: csdrRows } = await client.query(
                `CALL public.sp_generate_csdr($1, NULL)`,
                [trial_id]
            );
            csdrReport = csdrRows[0]?.csdr_report ?? null;
        } catch (e) {
            // sp_generate_csdr may not exist in all environments — non-fatal
            console.warn('sp_generate_csdr failed (non-fatal):', (e as any).message);
        }

        // Insert the dataset record
        const { rows } = await client.query(`
            INSERT INTO public.analysis_datasets
                (trial_id, dataset_name, dataset_type, snapshot_date, data_cutoff_date,
                 population_count, p_value, statistical_significance, analysis_results)
            VALUES ($1, $2, $3, CURRENT_DATE, $4,
                    COALESCE(($5::jsonb->'patient_accountability'->>'enrolled')::INT, 0),
                    $6, $7, $5)
            RETURNING *
        `, [
            trial_id, dataset_name, dataset_type, data_cutoff_date || null,
            JSON.stringify(csdrReport), p_value || null,
            statistical_significance !== undefined ? statistical_significance : null
        ]);

        await client.query('COMMIT');
        res.status(201).json(rows[0]);
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Create dataset error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// GET /api/statistics/datasets/:id — full dataset detail
router.get('/datasets/:id', async (req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT ad.*, ct.trial_title, ct.trial_nct_id
            FROM public.analysis_datasets ad
            JOIN public.clinical_trials ct ON ct.trial_id = ad.trial_id
            WHERE ad.dataset_id = $1
        `, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Dataset not found' });
        res.json(rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/statistics/datasets/:id/pvalue — update p-value and significance only
router.put('/datasets/:id/pvalue', async (req: Request, res: Response) => {
    const { p_value, statistical_significance } = req.body;
    const u = (req as any).user;
    const client = await pool.connect();
    try {
        // Transaction for audit trigger to capture the update
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.current_user_id', $1::text, true)", [(u?.user_id ?? 0).toString()]);
        await client.query("SELECT set_config('app.change_reason', $1::text, true)", ['Statistician updated p-value']);
        const { rows } = await client.query(`
            UPDATE public.analysis_datasets
            SET p_value = $1, statistical_significance = $2
            WHERE dataset_id = $3
            RETURNING *
        `, [p_value, statistical_significance, req.params.id]);
        await client.query('COMMIT');
        if (!rows.length) return res.status(404).json({ error: 'Dataset not found' });
        res.json(rows[0]);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// GET /api/statistics/datasets/:id/audit — last 3 audit entries for a dataset
router.get('/datasets/:id/audit', async (req: Request, res: Response) => {
    try {
        // Fetch recent audit trail entries for this dataset from 21 CFR audit table
        const { rows } = await pool.query(`
            SELECT at.action_type, at.change_reason, at.change_timestamp, at.changed_by_user_id,
                   u.username
            FROM public.audit_trail_21cfr at
            LEFT JOIN public.users u ON u.user_id = at.changed_by_user_id
            WHERE at.table_name = 'analysis_datasets'
              AND at.record_id = $1
            ORDER BY at.change_timestamp DESC
            LIMIT 3
        `, [req.params.id]);
        res.json(rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// PAGE 2: SURVIVAL ANALYSIS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/statistics/survival/:trialId — all survival analyses for a trial
router.get('/survival/:trialId', async (req: Request, res: Response) => {
    try {
        // List all survival analyses for a given trial with study info
        const { rows } = await pool.query(`
            SELECT
                sa.analysis_id,
                sa.trial_id,
                sa.endpoint_type,
                sa.time_points,
                sa.survival_probabilities,
                sa.hazard_ratio,
                sa.logrank_p_value,
                sa.confidence_interval_95,
                sa.calculated_at,
                ct.trial_title
            FROM public.survival_analysis sa
            JOIN public.clinical_trials ct ON ct.trial_id = sa.trial_id
            WHERE sa.trial_id = $1
            ORDER BY sa.calculated_at DESC
        `, [req.params.trialId]);
        res.json(rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/statistics/survival — run new survival analysis via sp_calculate_survival
router.post('/survival', async (req: Request, res: Response) => {
    const { trial_id, endpoint_type } = req.body;
    const u = (req as any).user;
    if (!trial_id || !endpoint_type) {
        return res.status(400).json({ error: 'trial_id and endpoint_type are required' });
    }
    const client = await pool.connect();
    try {
        // Explicit transaction — audit trigger fires on INSERT into survival_analysis
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.current_user_id', $1::text, true)", [(u?.user_id ?? 0).toString()]);
        await client.query("SELECT set_config('app.change_reason', $1::text, true)", ['Statistician ran survival analysis']);

        // Call the stored procedure (writes to survival_analysis table)
        await client.query(`CALL public.sp_calculate_survival($1, $2)`, [trial_id, endpoint_type]);

        // Retrieve the newly created record
        const { rows } = await client.query(`
            SELECT sa.*, ct.trial_title
            FROM public.survival_analysis sa
            JOIN public.clinical_trials ct ON ct.trial_id = sa.trial_id
            WHERE sa.trial_id = $1 AND sa.endpoint_type = $2
            ORDER BY sa.calculated_at DESC LIMIT 1
        `, [trial_id, endpoint_type]);

        await client.query('COMMIT');
        res.json({ ...rows[0], _procedure: 'sp_calculate_survival' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Survival calc error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// POST /api/statistics/survival/subgroup — Complex Query 1: subgroup survival data
// Uses CROSS JOIN LATERAL, multiple aggregations, stratification by factor
router.post('/survival/subgroup', async (req: Request, res: Response) => {
    const { trial_id, stratification_factor } = req.body;
    if (!trial_id) return res.status(400).json({ error: 'trial_id required' });
    try {
        // Subgroup survival data with CROSS JOIN LATERAL across stratification factors
        const { rows } = await pool.query(`
            SELECT
                sub.stratification_factor,
                sub.subgroup_value,
                COUNT(DISTINCT ra.patient_id) AS n,
                COUNT(DISTINCT ae.ae_id) FILTER (WHERE ae.results_in_death) AS events,
                ROUND(
                    COUNT(DISTINCT ae.ae_id) FILTER (WHERE ae.results_in_death)::DECIMAL /
                    NULLIF(COUNT(DISTINCT ra.patient_id), 0) * 100
                , 1) AS event_rate,
                ROUND(
                    AVG(EXTRACT(DAY FROM COALESCE(ae.ae_start_date, CURRENT_DATE)
                        - p.enrollment_date) / 30.0)::NUMERIC
                , 1) AS median_time_months
            FROM public.randomization_assignments ra
            JOIN public.patients p ON p.patient_id = ra.patient_id
            JOIN public.treatment_arms ta ON ta.arm_id = ra.arm_id
            LEFT JOIN public.adverse_events ae ON ae.patient_id = ra.patient_id
                AND ae.results_in_death = TRUE
            CROSS JOIN LATERAL (
                VALUES
                    ('Gender', COALESCE(p.gender, 'Unknown')),
                    ('Arm', ta.arm_code)
            ) AS sub(stratification_factor, subgroup_value)
            WHERE ta.trial_id = $1
              AND ($2::TEXT IS NULL OR sub.stratification_factor = $2)
            GROUP BY sub.stratification_factor, sub.subgroup_value
            ORDER BY sub.stratification_factor, sub.subgroup_value
        `, [trial_id, stratification_factor || null]);
        res.json(rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// PAGE 3: POWER ANALYSIS
// ════════════════════════════════════════════════════════════════════════════

// POST /api/statistics/power — run power analysis via sp_calculate_power_analysis
router.post('/power', async (req: Request, res: Response) => {
    const { trial_id, effect_size = 0.5, alpha = 0.05, power_target = 0.8 } = req.body;
    if (!trial_id) return res.status(400).json({ error: 'trial_id required' });
    const u = (req as any).user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.current_user_id', $1::text, true)", [(u?.user_id ?? 0).toString()]);
        await client.query("SELECT set_config('app.change_reason', $1::text, true)", ['Statistician ran power analysis']);

        // Call sp_calculate_power_analysis — INOUT params: required_sample_size, current_power
        const { rows } = await client.query(
            `CALL public.sp_calculate_power_analysis($1, $2, $3, $4, NULL, NULL)`,
            [trial_id, effect_size, alpha, power_target]
        );

        await client.query('COMMIT');
        res.json({
            requiredSampleSize: rows[0]?.required_sample_size ?? null,
            currentPower: rows[0]?.current_power ? parseFloat(rows[0].current_power) : null,
            effectSize: effect_size,
            alpha,
            powerTarget: power_target,
            _procedure: 'sp_calculate_power_analysis',
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Power calc error:', err.message);
        // Return a structured error so the frontend can fall back to client-side formula
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// GET /api/statistics/enrollment/:trialId — enrollment context for power analysis page
router.get('/enrollment/:trialId', async (req: Request, res: Response) => {
    try {
        // Current enrollment and site count for the trial (from mv_site_enrollment)
        const { rows } = await pool.query(`
            SELECT
                ct.trial_id,
                ct.trial_title,
                ct.target_enrollment,
                COALESCE(SUM(mse.current_enrollment), 0) AS total_enrolled,
                COUNT(DISTINCT mse.site_id) AS site_count
            FROM public.clinical_trials ct
            LEFT JOIN public.mv_site_enrollment mse ON mse.trial_id = ct.trial_id
            WHERE ct.trial_id = $1
            GROUP BY ct.trial_id, ct.trial_title, ct.target_enrollment
        `, [req.params.trialId]);
        res.json(rows[0] ?? null);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// PAGE 4: RANDOMIZATION BALANCE
// ════════════════════════════════════════════════════════════════════════════

// GET /api/statistics/balance/:trialId — enriched balance data with SD for SMD calculation
router.get('/balance/:trialId', async (req: Request, res: Response) => {
    try {
        // Balance per arm: counts, age stats, gender breakdown, enrollment dates
        const { rows } = await pool.query(`
            SELECT
                ct.trial_id,
                ct.trial_title,
                ta.arm_id,
                ta.arm_code,
                ta.arm_description,
                COUNT(DISTINCT ra.patient_id) AS patient_count,
                ROUND(AVG(EXTRACT(YEAR FROM AGE(p.date_of_birth)))::NUMERIC, 1) AS avg_age,
                ROUND(STDDEV(EXTRACT(YEAR FROM AGE(p.date_of_birth)))::NUMERIC, 2) AS sd_age,
                COUNT(DISTINCT p.patient_id) FILTER (WHERE p.gender = 'Male')   AS male_count,
                COUNT(DISTINCT p.patient_id) FILTER (WHERE p.gender = 'Female') AS female_count,
                MIN(p.enrollment_date) AS first_enrollment,
                MAX(p.enrollment_date) AS last_enrollment,
                ROUND(
                    COUNT(DISTINCT p.patient_id) FILTER (WHERE p.gender = 'Male')::DECIMAL /
                    NULLIF(COUNT(DISTINCT ra.patient_id), 0) * 100
                , 1) AS pct_male
            FROM public.randomization_assignments ra
            JOIN public.patients p ON p.patient_id = ra.patient_id
            JOIN public.treatment_arms ta ON ta.arm_id = ra.arm_id
            JOIN public.clinical_trials ct ON ct.trial_id = ta.trial_id
            WHERE ct.trial_id = $1
            GROUP BY ct.trial_id, ct.trial_title, ta.arm_id, ta.arm_code, ta.arm_description
            ORDER BY ta.arm_id
        `, [req.params.trialId]);
        res.json(rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// PAGE 5: SAFETY STATISTICS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/statistics/safety-stats/:trialId — AE rates with arm denominators (Complex Query 2)
router.get('/safety-stats/:trialId', async (req: Request, res: Response) => {
    try {
        // Complex Query 2: AE incidence rates with arm denominators via derived subquery
        const { rows } = await pool.query(`
            SELECT
                mab.ae_term,
                mab.arm_id,
                mab.arm_code,
                mab.occurrence_count,
                mab.avg_severity,
                mab.grade3plus_count,
                mab.life_threatening_count,
                mab.hospitalization_count,
                arm_totals.arm_patient_count,
                ROUND(
                    mab.occurrence_count::DECIMAL /
                    NULLIF(arm_totals.arm_patient_count, 0) * 100
                , 2) AS incidence_rate_pct
            FROM public.mv_ae_by_arm mab
            JOIN (
                SELECT ta.arm_id, COUNT(DISTINCT ra.patient_id) AS arm_patient_count
                FROM public.treatment_arms ta
                JOIN public.randomization_assignments ra ON ra.arm_id = ta.arm_id
                GROUP BY ta.arm_id
            ) arm_totals ON arm_totals.arm_id = mab.arm_id
            WHERE mab.trial_id = $1
              AND mab.ae_term IS NOT NULL
            ORDER BY mab.occurrence_count DESC
        `, [req.params.trialId]);
        res.json(rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/statistics/safety-stats/incidence/:trialId — calls calculate_ae_incidence_rates function
router.get('/safety-stats/incidence/:trialId', async (req: Request, res: Response) => {
    try {
        // Call the PostgreSQL function defined in migration 009_stat_function.sql
        const { rows } = await pool.query(
            `SELECT * FROM public.calculate_ae_incidence_rates($1)`,
            [req.params.trialId]
        );
        res.json(rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/statistics/safety-stats/exposure/:trialId — exposure (patient-years) per arm
router.get('/safety-stats/exposure/:trialId', async (req: Request, res: Response) => {
    try {
        // Compute total patient-years of observation per arm
        const { rows } = await pool.query(`
            SELECT
                ta.arm_code,
                COUNT(DISTINCT ra.patient_id) AS n_patients,
                ROUND(SUM(
                    EXTRACT(DAY FROM
                        COALESCE(p.updated_at::DATE, CURRENT_DATE) - p.enrollment_date
                    ) / 365.0
                )::NUMERIC, 2) AS total_patient_years
            FROM public.randomization_assignments ra
            JOIN public.patients p ON p.patient_id = ra.patient_id
            JOIN public.treatment_arms ta ON ta.arm_id = ra.arm_id
            WHERE ta.trial_id = $1
            GROUP BY ta.arm_id, ta.arm_code
            ORDER BY ta.arm_id
        `, [req.params.trialId]);
        res.json(rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// PAGE 6: INTERIM ANALYSIS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/statistics/interim/context/:trialId — Complex Query 3: comprehensive trial stats
router.get('/interim/context/:trialId', async (req: Request, res: Response) => {
    try {
        // Complex Query 3: complete trial statistics summary for interim analysis context
        // Uses multiple LEFT JOINs, FILTER aggregations, ratio calculations
        const { rows } = await pool.query(`
            SELECT
                ct.trial_id,
                ct.trial_title,
                ct.trial_phase,
                ct.target_enrollment,
                COUNT(DISTINCT p.patient_id) AS total_enrolled,
                COUNT(DISTINCT p.patient_id) FILTER (WHERE p.patient_status = 'Active')     AS active_patients,
                COUNT(DISTINCT p.patient_id) FILTER (WHERE p.patient_status = 'Completed')  AS completers,
                COUNT(DISTINCT ae.ae_id)                                                      AS total_ae,
                COUNT(DISTINCT ae.ae_id) FILTER (WHERE ae.results_in_death)                  AS total_deaths,
                COUNT(DISTINCT ae.ae_id) FILTER (WHERE ae.severity_grade >= 3)               AS grade3plus_ae,
                ROUND(
                    COUNT(DISTINCT p.patient_id)::DECIMAL /
                    NULLIF(ct.target_enrollment, 0) * 100
                , 1) AS enrollment_pct,
                ROUND(
                    AVG(EXTRACT(YEAR FROM AGE(p.date_of_birth)))::NUMERIC
                , 1) AS median_age,
                COUNT(DISTINCT p.patient_id) FILTER (WHERE p.gender = 'Male')   AS male_count,
                COUNT(DISTINCT p.patient_id) FILTER (WHERE p.gender = 'Female') AS female_count,
                COUNT(DISTINCT dl.lock_id) FILTER (WHERE dl.unlock_date IS NULL) AS active_locks,
                MAX(dl.lock_date) AS last_lock_date,
                ROUND(
                    COUNT(DISTINCT ae.ae_id)::DECIMAL /
                    NULLIF(COUNT(DISTINCT p.patient_id), 0)
                , 3) AS ae_per_patient_ratio
            FROM public.clinical_trials ct
            JOIN public.study_sites ss ON ss.trial_id = ct.trial_id
            LEFT JOIN public.patients p ON p.site_id = ss.site_id
            LEFT JOIN public.adverse_events ae ON ae.patient_id = p.patient_id
            LEFT JOIN public.data_locks dl ON dl.trial_id = ct.trial_id
            WHERE ct.trial_id = $1
            GROUP BY ct.trial_id, ct.trial_title, ct.trial_phase, ct.target_enrollment
        `, [req.params.trialId]);
        res.json(rows[0] ?? null);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/statistics/interim/locks/:trialId — active data locks for dropdown
router.get('/interim/locks/:trialId', async (req: Request, res: Response) => {
    try {
        // Active (unlocked) data locks for this trial
        const { rows } = await pool.query(`
            SELECT
                dl.lock_id,
                dl.lock_type,
                dl.lock_date,
                ct.trial_title,
                u.username AS locked_by
            FROM public.data_locks dl
            JOIN public.clinical_trials ct ON ct.trial_id = dl.trial_id
            LEFT JOIN public.users u ON u.user_id = dl.locked_by_user_id
            WHERE dl.trial_id = $1
              AND dl.unlock_date IS NULL
            ORDER BY dl.lock_date DESC
        `, [req.params.trialId]);
        res.json(rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/statistics/dsmb/:trialId/latest — latest DSMB recommendation
router.get('/dsmb/:trialId/latest', async (req: Request, res: Response) => {
    try {
        // Most recent DSMB meeting record for this trial
        const { rows } = await pool.query(`
            SELECT dm.meeting_id, dm.meeting_date, dm.data_cutoff_date, dm.recommendation,
                   dm.summary_notes, u.username AS recorded_by
            FROM public.dsmb_meetings dm
            LEFT JOIN public.users u ON u.user_id = dm.recorded_by_user_id
            WHERE dm.trial_id = $1
            ORDER BY dm.meeting_date DESC
            LIMIT 1
        `, [req.params.trialId]);
        res.json(rows[0] ?? null);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// PAGE 7: CDISC EXPORT (Statistician version)
// ════════════════════════════════════════════════════════════════════════════

// GET /api/statistics/export/counts/:trialId — record count preview per domain
router.get('/export/counts/:trialId', async (req: Request, res: Response) => {
    try {
        // Count records per CDISC domain before full export
        const { rows } = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM public.patients p
                 JOIN public.study_sites ss ON ss.site_id = p.site_id
                 WHERE ss.trial_id = $1) AS dm_count,
                (SELECT COUNT(*) FROM public.adverse_events ae
                 JOIN public.patients p ON p.patient_id = ae.patient_id
                 JOIN public.study_sites ss ON ss.site_id = p.site_id
                 WHERE ss.trial_id = $1) AS ae_count,
                (SELECT COUNT(*) FROM public.vital_signs vs
                 JOIN public.patients p ON p.patient_id = vs.patient_id
                 JOIN public.study_sites ss ON ss.site_id = p.site_id
                 WHERE ss.trial_id = $1) AS vs_count,
                (SELECT COUNT(*) FROM public.lab_results lr
                 JOIN public.patients p ON p.patient_id = lr.patient_id
                 JOIN public.study_sites ss ON ss.site_id = p.site_id
                 WHERE ss.trial_id = $1) AS lb_count
        `, [req.params.trialId]);
        res.json(rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/statistics/export/sdtm — CDISC SDTM export via sp_export_cdisc_sdtm
router.post('/export/sdtm', async (req: Request, res: Response) => {
    const { trial_id, domains = ['DM', 'AE', 'VS', 'LB'] } = req.body;
    if (!trial_id) return res.status(400).json({ error: 'trial_id required' });
    try {
        const result = await pool.query(
            `CALL public.sp_export_cdisc_sdtm($1, NULL::JSONB, NULL::JSONB, NULL::JSONB, NULL::JSONB)`,
            [trial_id]
        );

        const row = result.rows[0] ?? {};

        const requested = Array.isArray(domains)
            ? (domains as string[]).map((d: string) => d.toUpperCase())
            : (domains as string).split(',').map((d: string) => d.trim().toUpperCase());

        let dmData = row.dm_data ?? [];
        let aeData = row.ae_data ?? [];
        let vsData = row.vs_data ?? [];
        let lbData = row.lb_data ?? [];

        // AE augmentation: add AEGRPID (per-patient sequence) and AEOUT (outcome)
        if (Array.isArray(aeData)) {
            const ptGroups: Record<string, number> = {};
            aeData = aeData.map((ae: any) => {
                const pt = ae.USUBJID ?? ae.usubjid ?? '';
                ptGroups[pt] = (ptGroups[pt] ?? 0) + 1;
                return {
                    ...ae,
                    AEGRPID: ptGroups[pt],
                    AEOUT: ae.AEENDTC || ae.ae_end_date ? 'Recovered' : 'Recovering',
                };
            });
        }

        // LB augmentation: add LBNRIND and LBSTRESN
        if (Array.isArray(lbData)) {
            lbData = lbData.map((lb: any) => ({
                ...lb,
                LBNRIND: lb.LBNRIND ?? lb.lbnrind ?? (lb.critical_result_flag === 'Y' ? 'HIGH' : 'NORMAL'),
                LBSTRESN: lb.LBORRES ?? lb.result_value ?? null,
            }));
        }

        const out: Record<string, any> = {};
        if (requested.includes('DM')) out.DM = dmData;
        if (requested.includes('AE')) out.AE = aeData;
        if (requested.includes('VS')) out.VS = vsData;
        if (requested.includes('LB')) out.LB = lbData;

        res.json({ data: out, _procedure: 'sp_export_cdisc_sdtm' });
    } catch (err: any) {
        console.error('SDTM export error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;
