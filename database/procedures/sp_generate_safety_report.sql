CREATE OR REPLACE PROCEDURE sp_generate_safety_report(
    p_trial_id INTEGER,
    p_cutoff_date DATE DEFAULT CURRENT_DATE,
    INOUT report JSONB DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    SELECT jsonb_build_object(
        'trial_id', t.trial_id,
        'trial_title', t.trial_title,
        'cutoff_date', p_cutoff_date,
        'adverse_events', jsonb_build_object(
            'total', COUNT(DISTINCT ae.ae_id),
            'by_severity', (
                SELECT jsonb_object_agg(severity_grade::TEXT, cnt)
                FROM (
                    SELECT severity_grade, COUNT(DISTINCT ae_id) as cnt
                    FROM adverse_events ae2
                    JOIN patients p2 ON ae2.patient_id = p2.patient_id
                    JOIN study_sites ss2 ON p2.site_id = ss2.site_id
                    WHERE ss2.trial_id = p_trial_id AND ae2.ae_start_date <= p_cutoff_date
                    GROUP BY severity_grade
                ) s
            ),
            'serious', COUNT(DISTINCT sae.sae_id),
            'deaths', COUNT(DISTINCT CASE WHEN ae.results_in_death THEN ae.ae_id END)
        ),
        'safety_alerts', COUNT(DISTINCT sa.alert_id),
        'protocol_deviations', COUNT(DISTINCT pd.deviation_id)
    ) INTO report
    FROM clinical_trials t
    LEFT JOIN study_sites ss ON t.trial_id = ss.trial_id
    LEFT JOIN patients p ON ss.site_id = p.site_id
    LEFT JOIN adverse_events ae ON p.patient_id = ae.patient_id AND ae.ae_start_date <= p_cutoff_date
    LEFT JOIN serious_adverse_events sae ON ae.ae_id = sae.ae_id
    LEFT JOIN safety_alerts sa ON p.patient_id = sa.patient_id AND sa.created_at <= p_cutoff_date
    LEFT JOIN protocol_deviations pd ON p.patient_id = pd.patient_id AND pd.deviation_date <= p_cutoff_date
    WHERE t.trial_id = p_trial_id
    GROUP BY t.trial_id, t.trial_title;
END;
$$;