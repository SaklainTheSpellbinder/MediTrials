-- Get visits scheduled for today (or specific date) for a site

SELECT 
    p.trial_patient_id AS full_name,
    p.trial_patient_id,
    vs.visit_name,
    pv.scheduled_date,
    pv.visit_status,
    pv.visit_window_status,
    TO_CHAR(pv.scheduled_date, 'HH24:MI') as visit_time
FROM 
    patient_visits pv
JOIN 
    patients p ON pv.patient_id = p.patient_id
JOIN 
    visit_schedules vs ON pv.visit_id = vs.visit_id
WHERE 
    p.site_id = $1
    AND pv.scheduled_date = CURRENT_DATE
ORDER BY 
    pv.scheduled_date ASC;
