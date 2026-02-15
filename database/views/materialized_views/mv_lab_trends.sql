-- 7. Lab Trends Over Time
CREATE MATERIALIZED VIEW mv_lab_trends AS
SELECT 
    p.patient_id,
    p.trial_patient_id,
    lt.test_id,
    lt.test_name,
    jsonb_agg(
        jsonb_build_object(
            'date', lr.result_date::DATE,
            'value', lr.result_value,
            'reference_low', lr.reference_low,
            'reference_high', lr.reference_high
        ) ORDER BY lr.result_date
    ) as trend_data,
    COUNT(lr.result_id) as measurement_count,
    MIN(lr.result_value) as min_value,
    MAX(lr.result_value) as max_value,
    ROUND(AVG(lr.result_value), 2) as avg_value
FROM lab_results lr
JOIN laboratory_tests lt ON lr.test_id = lt.test_id
JOIN patients p ON lr.patient_id = p.patient_id
GROUP BY p.patient_id, p.trial_patient_id, lt.test_id, lt.test_name;