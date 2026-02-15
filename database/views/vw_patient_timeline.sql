-- Regular View: Patient Timeline
CREATE OR REPLACE VIEW vw_patient_timeline AS
SELECT 
    p.patient_id,
    p.trial_patient_id,
    p.enrollment_date as event_date,
    'Enrollment' as event_type,
    'Patient enrolled in study' as description,
    NULL::INTEGER as visit_id,
    NULL::NUMERIC as result_value
FROM patients p
WHERE p.enrollment_date IS NOT NULL

UNION ALL

SELECT 
    p.patient_id,
    p.trial_patient_id,
    pv.actual_visit_date as event_date,
    'Visit' as event_type,
    CONCAT('Visit: ', vs.visit_name) as description,
    pv.visit_instance_id,
    NULL::NUMERIC as result_value
FROM patients p
JOIN patient_visits pv ON p.patient_id = pv.patient_id
JOIN visit_schedules vs ON pv.visit_id = vs.visit_id
WHERE pv.actual_visit_date IS NOT NULL

UNION ALL

SELECT 
    p.patient_id,
    p.trial_patient_id,
    ae.ae_start_date as event_date,
    'Adverse Event' as event_type,
    CONCAT('AE: ', ae.ae_term, ' (Grade ', ae.severity_grade, ')') as description,
    ae.visit_instance_id,
    ae.severity_grade::NUMERIC as result_value
FROM patients p
JOIN adverse_events ae ON p.patient_id = ae.patient_id

UNION ALL

SELECT 
    p.patient_id,
    p.trial_patient_id,
    lr.result_date::DATE as event_date,
    'Critical Lab' as event_type,
    CONCAT('Critical: ', lt.test_name, ' = ', lr.result_value) as description,
    lr.visit_instance_id,
    lr.result_value
FROM patients p
JOIN lab_results lr ON p.patient_id = lr.patient_id
JOIN laboratory_tests lt ON lr.test_id = lt.test_id
WHERE lr.critical_result_flag = 'Y'

ORDER BY patient_id, event_date;