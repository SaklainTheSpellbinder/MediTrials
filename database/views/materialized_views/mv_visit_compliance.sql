-- 4. Visit Compliance
CREATE MATERIALIZED VIEW mv_visit_compliance AS
SELECT 
    p.patient_id,
    p.trial_patient_id,
    COUNT(DISTINCT pv.visit_instance_id) as scheduled_visits,
    COUNT(DISTINCT CASE WHEN pv.visit_status = 'Completed' THEN pv.visit_instance_id END) as completed_visits,
    COUNT(DISTINCT CASE WHEN pv.visit_status = 'Missed' THEN pv.visit_instance_id END) as missed_visits,
    ROUND(
        COUNT(DISTINCT CASE WHEN pv.visit_status = 'Completed' THEN pv.visit_instance_id END)::DECIMAL / 
        NULLIF(COUNT(DISTINCT pv.visit_instance_id), 0)::DECIMAL * 100, 2
    ) as compliance_percentage
FROM patients p
LEFT JOIN patient_visits pv ON p.patient_id = pv.patient_id
GROUP BY p.patient_id, p.trial_patient_id;