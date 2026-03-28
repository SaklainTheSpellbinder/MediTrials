import { Router } from 'express';
import { pool } from '../config/db';

const router = Router();

// Middleware to ensure patient_id is provided and valid
const requirePatientId = (req: any, res: any, next: any) => {
    const patientId = parseInt(req.params.patientId);
    if (isNaN(patientId)) {
        return res.status(400).json({ error: 'Invalid patient_id' });
    }
    req.patientId = patientId;
    next();
};

// GET /api/patients/:patientId/profile (Header Bar)
router.get('/:patientId/profile', requirePatientId, async (req: any, res: any) => {
    try {
        const query = `
            SELECT 
                p.patient_id,
                p.trial_patient_id,
                p.trial_patient_id AS full_name,
                p.date_of_birth,
                p.gender,
                p.patient_status,
                p.enrollment_date,
                p.site_id,
                s.institution_name,
                ta.arm_code as treatment_arm,
                (
                    SELECT jsonb_agg(jsonb_build_object('condition', pmh.condition_name, 'active', pmh.is_active))
                    FROM patient_medical_history pmh
                    WHERE pmh.patient_id = p.patient_id
                ) as medical_history_summary
            FROM patients p
            LEFT JOIN study_sites s ON p.site_id = s.site_id
            LEFT JOIN randomization_assignments ra ON p.patient_id = ra.patient_id
            LEFT JOIN treatment_arms ta ON ra.arm_id = ta.arm_id
            WHERE p.patient_id = $1;
        `;
        const result = await pool.query(query, [req.patientId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        res.json({ success: true, profile: result.rows[0] });
    } catch (err: any) {
        console.error('Error fetching patient profile:', err);
        res.status(500).json({ error: 'Server error fetching patient profile' });
    }
});

// GET /api/patients/:patientId/timeline
router.get('/:patientId/timeline', requirePatientId, async (req: any, res: any) => {
    try {
        const query = `
            SELECT 
                event_date,
                event_type,
                description,
                visit_id as visit_instance_id,
                result_value
            FROM vw_patient_timeline
            WHERE patient_id = $1
            ORDER BY event_date DESC;
        `;
        const result = await pool.query(query, [req.patientId]);
        res.json({ success: true, timeline: result.rows });
    } catch (err: any) {
        console.error('Error fetching patient timeline:', err);
        res.status(500).json({ error: 'Server error fetching timeline' });
    }
});

// GET /api/patients/:patientId/clinical
router.get('/:patientId/clinical', requirePatientId, async (req: any, res: any) => {
    try {
        const visitQuery = `
            SELECT 
                vs.visit_name,
                pv.scheduled_date,
                pv.actual_visit_date,
                pv.visit_status,
                pv.visit_window_status
            FROM patient_visits pv
            JOIN visit_schedules vs ON pv.visit_id = vs.visit_id
            WHERE pv.patient_id = $1
            ORDER BY vs.day_offset ASC;
        `;
        const vitalsQuery = `
            SELECT 
                measurement_time,
                systolic_bp,
                diastolic_bp,
                heart_rate,
                temperature,
                oxygen_saturation
            FROM vital_signs
            WHERE patient_id = $1
            ORDER BY measurement_time DESC
            LIMIT 5;
        `;
        const historyQuery = `
            SELECT 
                condition_name,
                diagnosis_date,
                severity,
                is_active,
                notes
            FROM patient_medical_history
            WHERE patient_id = $1
            ORDER BY diagnosis_date DESC NULLS LAST;
        `;

        const [visitsResult, vitalsResult, historyResult] = await Promise.all([
            pool.query(visitQuery, [req.patientId]),
            pool.query(vitalsQuery, [req.patientId]),
            pool.query(historyQuery, [req.patientId])
        ]);

        res.json({
            success: true,
            clinical: {
                visits: visitsResult.rows,
                vitals: vitalsResult.rows,
                history: historyResult.rows
            }
        });
    } catch (err: any) {
        console.error('Error fetching clinical data:', err);
        res.status(500).json({ error: 'Server error fetching clinical data' });
    }
});

// GET /api/patients/:patientId/safety
router.get('/:patientId/safety', requirePatientId, async (req: any, res: any) => {
    try {
        const aeQuery = `
            SELECT 
                ae_term,
                ae_start_date,
                ae_end_date,
                severity_grade,
                causality_relationship,
                treatment_related,
                (SELECT sae.sae_report_number FROM serious_adverse_events sae WHERE sae.ae_id = ae.ae_id) as sae_report_number
            FROM adverse_events ae
            WHERE patient_id = $1
            ORDER BY ae_start_date DESC;
        `;
        const alertsQuery = `
            SELECT 
                alert_code,
                alert_message,
                alert_severity,
                alert_status,
                created_at as alert_date
            FROM safety_alerts
            WHERE patient_id = $1
            ORDER BY created_at DESC;
        `;
        const protocolQuery = `
            SELECT 
                deviation_type,
                deviation_date,
                description,
                reported_to_irb
            FROM protocol_deviations
            WHERE patient_id = $1
            ORDER BY deviation_date DESC;
        `;

        const [aeResult, alertsResult, protocolResult] = await Promise.all([
            pool.query(aeQuery, [req.patientId]),
            pool.query(alertsQuery, [req.patientId]),
            pool.query(protocolQuery, [req.patientId])
        ]);

        res.json({
            success: true,
            safety: {
                adverseEvents: aeResult.rows,
                alerts: alertsResult.rows,
                protocolDeviations: protocolResult.rows
            }
        });
    } catch (err: any) {
        console.error('Error fetching safety data:', err);
        res.status(500).json({ error: 'Server error fetching safety data' });
    }
});

// GET /api/patients/:patientId/labs
router.get('/:patientId/labs', requirePatientId, async (req: any, res: any) => {
    try {
        const labsQuery = `
            SELECT 
                lr.result_id,
                p.trial_patient_id,
                p.trial_patient_id AS full_name,
                lt.test_name,
                lr.result_value,
                lr.result_date,
                lr.result_status,
                (lr.critical_result_flag = 'Y') as critical_result_flag,
                COALESCE(lt.reference_ranges->>LOWER(p.gender), lt.reference_ranges->>'all') as reference_range_text,
                lt.unit_of_measure,
                CASE 
                    WHEN lr.result_value <= lt.critical_low_value THEN 'Low'
                    WHEN lr.result_value >= lt.critical_high_value THEN 'High'
                    ELSE 'Normal'
                END as range_flag
            FROM lab_results lr
            JOIN laboratory_tests lt ON lr.test_id = lt.test_id
            JOIN patients p ON lr.patient_id = p.patient_id
            WHERE lr.patient_id = $1
            ORDER BY lr.result_date DESC;
        `;

        const result = await pool.query(labsQuery, [req.patientId]);

        res.json({
            success: true,
            labs: result.rows
        });
    } catch (err: any) {
        console.error('Error fetching lab results:', err);
        res.status(500).json({ error: 'Server error fetching lab results' });
    }
});

// GET /api/patients/:patientId/documents
router.get('/:patientId/documents', requirePatientId, async (req: any, res: any) => {
    try {
        const consentQuery = `
            SELECT 
                consent_version,
                consent_date,
                digital_signature_hash,
                is_withdrawn,
                withdrawal_date
            FROM informed_consent
            WHERE patient_id = $1
            ORDER BY consent_date DESC;
        `;
        const ecrfQuery = `
            SELECT 
                ed.ecrf_id,
                def.ecrf_name,
                ed.form_status,
                ed.data_entry_date,
                ed.investigator_signature,
                es.signature_hash,
                es.signed_at
            FROM ecrf_data ed
            JOIN ecrf_definitions def ON ed.ecrf_id = def.ecrf_id
            LEFT JOIN electronic_signatures es ON es.document_id = ed.ecrf_instance_id AND es.document_type = 'eCRF'
            WHERE ed.patient_id = $1 AND ed.form_status IN ('Signed', 'Locked')
            ORDER BY ed.data_entry_date DESC;
        `;
        // Simplification for audit trail
        const auditQuery = `
            SELECT 
                table_name,
                action_type,
                column_name,
                change_timestamp,
                change_reason,
                changed_by_user_id
            FROM audit_trail_21cfr
            WHERE (table_name = 'patients' AND record_id = $1)
            ORDER BY change_timestamp DESC
            LIMIT 50;
        `;

        const [consentResult, ecrfResult, auditResult] = await Promise.all([
            pool.query(consentQuery, [req.patientId]),
            pool.query(ecrfQuery, [req.patientId]),
            pool.query(auditQuery, [req.patientId])
        ]);

        res.json({
            success: true,
            documents: {
                consent: consentResult.rows,
                ecrfs: ecrfResult.rows,
                auditTrail: auditResult.rows
            }
        });
    } catch (err: any) {
        console.error('Error fetching documents data:', err);
        res.status(500).json({ error: 'Server error fetching documents data' });
    }
});

export default router;
