CREATE OR REPLACE PROCEDURE sp_calculate_power_analysis(
    p_trial_id INTEGER,
    p_effect_size DECIMAL DEFAULT 0.5,
    p_alpha DECIMAL DEFAULT 0.05,
    p_power_target DECIMAL DEFAULT 0.8,
    INOUT required_sample_size INTEGER DEFAULT NULL,
    INOUT current_power DECIMAL DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_current_enrollment INTEGER;
    v_target_enrollment INTEGER;
    v_event_rate DECIMAL := 0.3; -- Assumed event rate for power calculation
BEGIN
    -- Get current and target enrollment
    SELECT 
        SUM(ss.current_enrollment),
        ct.target_enrollment
    INTO v_current_enrollment, v_target_enrollment
    FROM study_sites ss
    JOIN clinical_trials ct ON ss.trial_id = ct.trial_id
    WHERE ct.trial_id = p_trial_id
    GROUP BY ct.target_enrollment;

    -- Simplified sample size formula for two proportions
    required_sample_size := CEIL(
        2 * (
            (1.96 * SQRT(2 * v_event_rate * (1 - v_event_rate)) + 
             0.84 * SQRT(p_effect_size * (1 - p_effect_size))
            ) ^ 2
        ) / (p_effect_size ^ 2)
    );

    -- Current power (simplified)
    current_power := ROUND(
        LEAST(1.0, v_current_enrollment::DECIMAL / required_sample_size::DECIMAL * p_power_target), 2
    );
END;
$$;