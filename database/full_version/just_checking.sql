SET search_path TO meditrials;

-- 🔥 TEST 1: Critical lab trigger
-- Should show Y flags and matching safety alerts
SELECT 
    lr.result_id,
    lt.test_name,
    lr.result_value,
    lr.critical_result_flag,
    lr.result_status,
    lt.critical_low_value,
    lt.critical_high_value
FROM lab_results lr
JOIN laboratory_tests lt ON lt.test_id = lr.test_id
WHERE lr.critical_result_flag = 'Y'
LIMIT 10;

-- And confirm alerts were created for them
SELECT 
    sa.alert_code,
    sa.alert_severity,
    sa.alert_message,
    sa.alert_status,
    sa.created_at
FROM safety_alerts sa
WHERE sa.alert_code = 'CRITICAL_LAB'
LIMIT 10;

-- 🔥 TEST 2: SAE escalation trigger
-- Any AE with severity >= 4 should have a matching SAE record
SELECT 
    ae.ae_id,
    ae.ae_term,
    ae.severity_grade,
    ae.life_threatening,
    ae.requires_hospitalization,
    CASE WHEN sae.sae_id IS NOT NULL THEN '✅ Escalated' ELSE '❌ Missing' END AS sae_status
FROM adverse_events ae
LEFT JOIN serious_adverse_events sae ON sae.ae_id = ae.ae_id
WHERE ae.severity_grade >= 4 
   OR ae.life_threatening = TRUE 
   OR ae.requires_hospitalization = TRUE
LIMIT 20;

-- 🔥 TEST 3: Site enrollment counter
-- current_enrollment should match actual patient count
SELECT 
    ss.site_id,
    ss.institution_name,
    ss.current_enrollment          AS counter_value,
    COUNT(p.patient_id)            AS actual_count,
    CASE 
        WHEN ss.current_enrollment = COUNT(p.patient_id) THEN '✅ Match'
        ELSE '❌ Mismatch — ' || ss.current_enrollment || ' vs ' || COUNT(p.patient_id)
    END AS status
FROM study_sites ss
LEFT JOIN patients p ON p.site_id = ss.site_id
GROUP BY ss.site_id, ss.institution_name, ss.current_enrollment
ORDER BY ss.site_id;

-- 🔥 TEST 4: Audit trail is capturing changes
SELECT
    table_name,
    action_type,
    COUNT(*) AS record_count,
    MIN(change_timestamp) AS earliest,
    MAX(change_timestamp) AS latest
FROM audit_trail_21cfr
GROUP BY table_name, action_type
ORDER BY table_name, action_type;

-- 🔥 TEST 5: Visit window status was computed
SELECT
    visit_window_status,
    COUNT(*) AS count
FROM patient_visits
WHERE actual_visit_date IS NOT NULL
GROUP BY visit_window_status
ORDER BY visit_window_status;

-- 🔥 TEST 6: Materialized views have data
SELECT 'mv_site_enrollment'      AS view_name, COUNT(*) AS rows FROM mv_site_enrollment
UNION ALL
SELECT 'mv_safety_overview',                   COUNT(*) FROM mv_safety_overview
UNION ALL
SELECT 'mv_data_quality',                      COUNT(*) FROM mv_data_quality
UNION ALL
SELECT 'mv_visit_compliance',                  COUNT(*) FROM mv_visit_compliance
UNION ALL
SELECT 'mv_ae_by_arm',                         COUNT(*) FROM mv_ae_by_arm
UNION ALL
SELECT 'mv_randomization_balance',             COUNT(*) FROM mv_randomization_balance
UNION ALL
SELECT 'mv_lab_trends',                        COUNT(*) FROM mv_lab_trends
UNION ALL
SELECT 'mv_protocol_deviations_summary',       COUNT(*) FROM mv_protocol_deviations_summary
UNION ALL
SELECT 'mv_query_resolution_time',             COUNT(*) FROM mv_query_resolution_time
ORDER BY view_name;