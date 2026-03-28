-- 008_get_site_lab_results.sql
-- Gets all latest Lab Results for patients associated with a specific site
-- Used by the Principal Investigator Lab Results page

SELECT 
    lr.result_id,
    p.trial_patient_id,
    p.full_name,
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
WHERE p.site_id = $1
ORDER BY lr.result_date DESC;
