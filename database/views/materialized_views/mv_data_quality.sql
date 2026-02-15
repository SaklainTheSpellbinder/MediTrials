-- 3. Data Quality Metrics
CREATE MATERIALIZED VIEW mv_data_quality AS
SELECT 
    p.patient_id,
    p.trial_patient_id,
    COUNT(DISTINCT ed.ecrf_instance_id) as total_forms,
    COUNT(DISTINCT CASE WHEN ed.form_status = 'Signed' THEN ed.ecrf_instance_id END) as signed_forms,
    SUM(ed.query_count) as total_queries,
    COUNT(DISTINCT dq.query_id) as open_queries
FROM patients p
LEFT JOIN patient_visits pv ON p.patient_id = pv.patient_id
LEFT JOIN ecrf_data ed ON pv.visit_instance_id = ed.visit_instance_id
LEFT JOIN data_queries dq ON ed.ecrf_instance_id = dq.ecrf_instance_id AND dq.query_status = 'Open'
GROUP BY p.patient_id, p.trial_patient_id;