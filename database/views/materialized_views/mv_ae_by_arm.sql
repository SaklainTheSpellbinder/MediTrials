-- 5. Adverse Events by Treatment Arm
CREATE MATERIALIZED VIEW mv_ae_by_arm AS
SELECT 
    ta.arm_id,
    ta.arm_code,
    ae.ae_term,
    COUNT(DISTINCT ae.ae_id) as occurrence_count,
    AVG(ae.severity_grade) as avg_severity,
    COUNT(DISTINCT CASE WHEN ae.severity_grade >= 3 THEN ae.ae_id END) as serious_count
FROM treatment_arms ta
LEFT JOIN randomization_assignments ra ON ta.arm_id = ra.arm_id
LEFT JOIN adverse_events ae ON ra.patient_id = ae.patient_id
GROUP BY ta.arm_id, ta.arm_code, ae.ae_term;