-- 8. Protocol Deviations Summary
CREATE MATERIALIZED VIEW mv_protocol_deviations_summary AS
SELECT 
    ss.site_id,
    ss.institution_name,
    pd.deviation_type,
    COUNT(DISTINCT pd.deviation_id) as deviation_count,
    COUNT(DISTINCT CASE WHEN pd.deviation_type = 'Major' THEN pd.deviation_id END) as major_deviations,
    COUNT(DISTINCT CASE WHEN pd.deviation_type = 'Critical' THEN pd.deviation_id END) as critical_deviations,
    COUNT(DISTINCT pd.patient_id) as affected_patients
FROM protocol_deviations pd
JOIN patients p ON pd.patient_id = p.patient_id
JOIN study_sites ss ON p.site_id = ss.site_id
GROUP BY ss.site_id, ss.institution_name, pd.deviation_type;