CREATE OR REPLACE PROCEDURE sp_detect_safety_signals(
    p_trial_id INTEGER,
    INOUT signals JSONB DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_total_patients INTEGER;
BEGIN
    -- Get total patients in trial
    SELECT COUNT(*) INTO v_total_patients
    FROM patients p
    JOIN study_sites ss ON p.site_id = ss.site_id
    WHERE ss.trial_id = p_trial_id;

    -- Calculate Proportional Reporting Ratio (PRR) for each AE term
    WITH ae_counts AS (
        SELECT 
            ae.ae_term,
            COUNT(DISTINCT ae.ae_id) as ae_count,
            COUNT(DISTINCT CASE WHEN ra.arm_id = ta.arm_id AND ta.arm_code != 'PLACEBO' THEN ae.ae_id END) as treatment_count
        FROM adverse_events ae
        JOIN patients p ON ae.patient_id = p.patient_id
        JOIN study_sites ss ON p.site_id = ss.site_id
        LEFT JOIN randomization_assignments ra ON p.patient_id = ra.patient_id
        LEFT JOIN treatment_arms ta ON ra.arm_id = ta.arm_id
        WHERE ss.trial_id = p_trial_id
        GROUP BY ae.ae_term
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'ae_term', ac.ae_term,
            'occurrence_count', ac.ae_count,
            'prr', ROUND(
                (ac.treatment_count / NULLIF(v_total_patients, 0)::DECIMAL) /
                NULLIF((ac.ae_count - ac.treatment_count) / NULLIF(v_total_patients, 0)::DECIMAL, 0), 2
            ),
            'signal_strength', CASE 
                WHEN ac.ae_count >= 3 AND ac.treatment_count >= 2 THEN 'HIGH'
                WHEN ac.ae_count >= 2 THEN 'MEDIUM'
                ELSE 'LOW'
            END
        )
    ) INTO signals
    FROM ae_counts ac
    WHERE ac.ae_count >= 2
    ORDER BY ac.ae_count DESC;
END;
$$;
