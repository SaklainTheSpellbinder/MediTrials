-- 004_get_safety_data.sql
-- Gets Adverse Events, Safety Alerts, and Protocol Deviations

-- Query 1: Adverse Events
SELECT 
    ae_term,
    ae_start_date,
    ae_end_date,
    severity_grade,
    causality_relationship,
    treatment_related,
    (SELECT sae.sae_report_number FROM serious_adverse_events sae WHERE sae.ae_id = ae.ae_id) as sae_report_number
FROM adverse_events ae
WHERE patient_id = $1
ORDER BY ae_start_date DESC;

-- Query 2: Safety Alerts
SELECT 
    alert_code,
    alert_message,
    alert_severity,
    alert_status,
    created_at as alert_date
FROM safety_alerts
WHERE patient_id = $1
ORDER BY created_at DESC;

-- Query 3: Protocol Deviations
SELECT 
    deviation_type,
    deviation_date,
    description,
    reported_to_irb
FROM protocol_deviations
WHERE patient_id = $1
ORDER BY deviation_date DESC;
