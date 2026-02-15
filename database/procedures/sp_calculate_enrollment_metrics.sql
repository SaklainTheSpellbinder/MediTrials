CREATE OR REPLACE PROCEDURE sp_calculate_enrollment_metrics(
    p_trial_id INTEGER,
    INOUT total_enrolled INTEGER DEFAULT NULL,
    INOUT enrollment_by_site JSONB DEFAULT NULL,
    INOUT screening_failure_rate DECIMAL DEFAULT NULL,
    INOUT enrollment_velocity DECIMAL DEFAULT NULL,
    INOUT projected_completion_date DATE DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_start_date DATE;
    v_target_enrollment INTEGER;
    v_days_elapsed INTEGER;
BEGIN
    -- Get trial start date and target
    SELECT start_date, target_enrollment 
    INTO v_start_date, v_target_enrollment
    FROM clinical_trials WHERE trial_id = p_trial_id;

    -- Total enrolled
    SELECT COUNT(*) INTO total_enrolled
    FROM patients p
    JOIN study_sites ss ON p.site_id = ss.site_id
    WHERE ss.trial_id = p_trial_id
      AND p.patient_status IN ('Enrolled', 'Active');

    -- Enrollment by site
    SELECT jsonb_object_agg(
        ss.institution_name,
        jsonb_build_object(
            'enrolled', COUNT(p.patient_id),
            'target', ss.target_enrollment,
            'percentage', ROUND(COUNT(p.patient_id)::DECIMAL / NULLIF(ss.target_enrollment, 0) * 100, 2)
        )
    ) INTO enrollment_by_site
    FROM study_sites ss
    LEFT JOIN patients p ON ss.site_id = p.site_id 
        AND p.patient_status IN ('Enrolled', 'Active')
    WHERE ss.trial_id = p_trial_id
    GROUP BY ss.trial_id;

    -- Screening failure rate
    SELECT 
        ROUND(
            COUNT(CASE WHEN ps.screening_status = 'Failed' THEN 1 END)::DECIMAL / 
            NULLIF(COUNT(ps.screening_id), 0) * 100, 2
        ) INTO screening_failure_rate
    FROM patient_screening ps
    JOIN patients p ON ps.patient_id = p.patient_id
    JOIN study_sites ss ON p.site_id = ss.site_id
    WHERE ss.trial_id = p_trial_id;

    -- Enrollment velocity (patients per week)
    v_days_elapsed := GREATEST(EXTRACT(DAY FROM CURRENT_DATE - v_start_date), 1);
    enrollment_velocity := ROUND(total_enrolled::DECIMAL / (v_days_elapsed / 7.0), 2);

    -- Projected completion date
    IF enrollment_velocity > 0 THEN
        projected_completion_date := CURRENT_DATE + 
            ((v_target_enrollment - total_enrolled) / enrollment_velocity * 7)::INTEGER;
    ELSE
        projected_completion_date := NULL;
    END IF;
END;
$$;
