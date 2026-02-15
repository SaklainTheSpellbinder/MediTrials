-- 2. Safety Overview
CREATE MATERIALIZED VIEW mv_safety_overview AS
SELECT 
    t.trial_id,
    t.trial_title,
    COUNT(DISTINCT ae.ae_id) as total_ae,
    COUNT(DISTINCT sae.sae_id) as total_sae,
    COUNT(DISTINCT sa.alert_id) as total_alerts,
    COUNT(DISTINCT pd.deviation_id) as total_deviations,
    COUNT(DISTINCT CASE WHEN ae.severity_grade >= 3 THEN ae.ae_id END) as serious_ae_count
FROM clinical_trials t
LEFT JOIN study_sites ss ON t.trial_id = ss.trial_id
LEFT JOIN patients p ON ss.site_id = p.site_id
LEFT JOIN adverse_events ae ON p.patient_id = ae.patient_id
LEFT JOIN serious_adverse_events sae ON ae.ae_id = sae.ae_id
LEFT JOIN safety_alerts sa ON p.patient_id = sa.patient_id
LEFT JOIN protocol_deviations pd ON p.patient_id = pd.patient_id
GROUP BY t.trial_id, t.trial_title;