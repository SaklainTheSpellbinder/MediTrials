CREATE OR REPLACE PROCEDURE sp_calculate_survival(
    p_trial_id INTEGER,
    p_endpoint_type VARCHAR DEFAULT 'Overall Survival'
)
LANGUAGE plpgsql AS $$
DECLARE
    v_time_points JSONB;
    v_survival_probs JSONB;
    v_hazard_ratio NUMERIC;
    v_p_value NUMERIC;
    v_ci_95 VARCHAR;
BEGIN
    -- Simplified Kaplan-Meier: just store placeholder
    v_time_points := '[30, 60, 90, 180, 365]'::JSONB;
    v_survival_probs := '[0.95, 0.90, 0.85, 0.80, 0.75]'::JSONB;
    v_hazard_ratio := 1.2;
    v_p_value := 0.05;
    v_ci_95 := '0.8-1.6';

    INSERT INTO survival_analysis (
        trial_id, endpoint_type, time_points, survival_probabilities,
        hazard_ratio, logrank_p_value, confidence_interval_95
    ) VALUES (
        p_trial_id, p_endpoint_type, v_time_points, v_survival_probs,
        v_hazard_ratio, v_p_value, v_ci_95
    );
END;
$$;