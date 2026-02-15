CREATE OR REPLACE PROCEDURE sp_generate_csdr(
    p_trial_id INTEGER,
    INOUT csdr_report JSONB DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_patient_accountability JSONB;
    v_data_completeness JSONB;
    v_query_status JSONB;
    v_deviations JSONB;
BEGIN
    -- Patient accountability
    SELECT jsonb_build_object(
        'screened', COUNT(DISTINCT CASE WHEN p.patient_status != 'Screen Failure' THEN p.patient_id END),
        'enrolled', COUNT(DISTINCT CASE WHEN p.patient_status IN ('Enrolled', 'Active') THEN p.patient_id END),
        'completed', COUNT(DISTINCT CASE WHEN p.patient_status = 'Completed' THEN p.patient_id END),
        'withdrawn', COUNT(DISTINCT CASE WHEN p.patient_status = 'Withdrawn' THEN p.patient_id END),
        'screen_failures', COUNT(DISTINCT CASE WHEN p.patient_status = 'Screen Failure' THEN p.patient_id END)
    ) INTO v_patient_accountability
    FROM patients p
    JOIN study_sites ss ON p.site_id = ss.site_id
    WHERE ss.trial_id = p_trial_id;

    -- Data completeness (simplified)
    SELECT jsonb_build_object(
        'total_forms_expected', COUNT(DISTINCT pv.visit_instance_id) * COUNT(DISTINCT ed.ecrf_id),
        'forms_completed', COUNT(DISTINCT ed2.ecrf_instance_id),
        'completion_rate', ROUND(
            COUNT(DISTINCT ed2.ecrf_instance_id)::DECIMAL / 
            NULLIF(COUNT(DISTINCT pv.visit_instance_id) * COUNT(DISTINCT ed.ecrf_id), 0) * 100, 2
        )
    ) INTO v_data_completeness
    FROM patients p
    JOIN study_sites ss ON p.site_id = ss.site_id
    LEFT JOIN patient_visits pv ON p.patient_id = pv.patient_id
    LEFT JOIN ecrf_definitions ed ON ss.trial_id = ed.trial_id
    LEFT JOIN ecrf_data ed2 ON pv.visit_instance_id = ed2.visit_instance_id AND ed2.ecrf_id = ed.ecrf_id
    WHERE ss.trial_id = p_trial_id;

    -- Query resolution status
    SELECT jsonb_build_object(
        'total_queries', COUNT(DISTINCT dq.query_id),
        'open_queries', COUNT(DISTINCT CASE WHEN dq.query_status = 'Open' THEN dq.query_id END),
        'resolved_queries', COUNT(DISTINCT CASE WHEN dq.query_status = 'Resolved' THEN dq.query_id END),
        'resolution_rate', ROUND(
            COUNT(DISTINCT CASE WHEN dq.query_status = 'Resolved' THEN dq.query_id END)::DECIMAL /
            NULLIF(COUNT(DISTINCT dq.query_id), 0) * 100, 2
        )
    ) INTO v_query_status
    FROM data_queries dq
    JOIN ecrf_data ed ON dq.ecrf_instance_id = ed.ecrf_instance_id
    JOIN patients p ON ed.patient_id = p.patient_id
    JOIN study_sites ss ON p.site_id = ss.site_id
    WHERE ss.trial_id = p_trial_id;

    -- Protocol deviations summary
    SELECT jsonb_build_object(
        'total_deviations', COUNT(DISTINCT pd.deviation_id),
        'by_type', (
            SELECT jsonb_object_agg(deviation_type, cnt)
            FROM (
                SELECT deviation_type, COUNT(DISTINCT deviation_id) as cnt
                FROM protocol_deviations pd2
                JOIN patients p2 ON pd2.patient_id = p2.patient_id
                JOIN study_sites ss2 ON p2.site_id = ss2.site_id
                WHERE ss2.trial_id = p_trial_id
                GROUP BY deviation_type
            ) t
        ),
        'reported_to_irb', COUNT(DISTINCT CASE WHEN pd.reported_to_irb THEN pd.deviation_id END)
    ) INTO v_deviations
    FROM protocol_deviations pd
    JOIN patients p ON pd.patient_id = p.patient_id
    JOIN study_sites ss ON p.site_id = ss.site_id
    WHERE ss.trial_id = p_trial_id;

    -- Combine into CSDR report
    csdr_report := jsonb_build_object(
        'trial_id', p_trial_id,
        'generation_date', CURRENT_DATE,
        'patient_accountability', v_patient_accountability,
        'data_completeness', v_data_completeness,
        'query_status', v_query_status,
        'protocol_deviations', v_deviations
    );
END;
$$;