-- 9. Query Resolution Time
CREATE MATERIALIZED VIEW mv_query_resolution_time AS
SELECT 
    ss.site_id,
    ss.institution_name,
    COUNT(DISTINCT dq.query_id) as total_queries,
    COUNT(DISTINCT CASE WHEN dq.query_status = 'Open' THEN dq.query_id END) as open_queries,
    COUNT(DISTINCT CASE WHEN dq.query_status = 'Resolved' THEN dq.query_id END) as resolved_queries,
    ROUND(
        AVG(EXTRACT(EPOCH FROM (dq.resolved_date - dq.raised_date)) / 86400) FILTER (WHERE dq.resolved_date IS NOT NULL), 
        2
    ) as avg_days_to_resolve,
    ROUND(
        MAX(EXTRACT(EPOCH FROM (dq.resolved_date - dq.raised_date)) / 86400) FILTER (WHERE dq.resolved_date IS NOT NULL), 
        2
    ) as max_days_to_resolve
FROM data_queries dq
JOIN ecrf_data ed ON dq.ecrf_instance_id = ed.ecrf_instance_id
JOIN patients p ON ed.patient_id = p.patient_id
JOIN study_sites ss ON p.site_id = ss.site_id
GROUP BY ss.site_id, ss.institution_name;