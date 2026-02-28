-- 005_get_lab_results.sql
-- Gets Lab Results for a patient

SELECT 
    lt.test_name,
    lr.result_value,
    lr.result_date,
    lr.result_status,
    lr.critical_result_flag,
    lr.reference_low,
    lr.reference_high,
    lt.unit_of_measure,
    CASE 
        WHEN lr.result_value < lr.reference_low THEN 'Low'
        WHEN lr.result_value > lr.reference_high THEN 'High'
        ELSE 'Normal'
    END as range_flag
FROM lab_results lr
JOIN laboratory_tests lt ON lr.test_id = lt.test_id
WHERE lr.patient_id = $1
ORDER BY lr.result_date DESC;
