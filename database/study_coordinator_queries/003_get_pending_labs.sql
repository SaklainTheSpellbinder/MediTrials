-- Get list of pending lab results

SELECT 
    p.full_name,
    p.trial_patient_id,
    lt.test_name,
    lr.result_status,
    lr.result_date,
    vs.visit_name
FROM 
    lab_results lr
JOIN 
    patients p ON lr.patient_id = p.patient_id
JOIN 
    laboratory_tests lt ON lr.test_id = lt.test_id
JOIN
    patient_visits pv ON lr.visit_instance_id = pv.visit_instance_id
JOIN
    visit_schedules vs ON pv.visit_id = vs.visit_id
WHERE 
    p.site_id = $1
    AND lr.result_status = 'Pending'
ORDER BY 
    lr.created_at DESC;
