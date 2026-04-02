-- Materialized View: mv_pi_dashboard_stats
-- Purpose: Pre-calculate dashboard statistics for Principal Investigators.
-- Aggregated by site_id.
-- Based on 'patients' and 'study_sites' tables.

DROP MATERIALIZED VIEW IF EXISTS mv_pi_dashboard_stats;

CREATE MATERIALIZED VIEW mv_pi_dashboard_stats AS
WITH site_counts AS (
    SELECT 
        site_id,
        COUNT(*) AS total_patients,
        COUNT(CASE WHEN patient_status IN ('Active', 'Enrolled') THEN 1 END) AS active_patients,
        COUNT(CASE WHEN patient_status = 'Screen Failure' THEN 1 END) AS screen_failures,
        COUNT(CASE WHEN patient_status = 'Completed' THEN 1 END) AS completed_patients,
        COUNT(CASE WHEN patient_status = 'Withdrawn' THEN 1 END) AS withdrawn_patients
    FROM 
        patients
    GROUP BY 
        site_id
),
site_targets AS (
    SELECT 
        site_id, 
        target_enrollment 
    FROM 
        study_sites
)
SELECT 
    sc.site_id,
    sc.total_patients,
    sc.active_patients,
    sc.screen_failures,
    
    -- Calculate Retention Rate: (Active + Completed) / (Total - Screen Failures) * 100
    CASE 
        WHEN (sc.total_patients - sc.screen_failures) > 0 
        THEN ROUND(
            ((sc.active_patients + sc.completed_patients)::DECIMAL / 
            NULLIF(sc.total_patients - sc.screen_failures, 0) * 100), 
            1
        )
        ELSE 0 
    END AS retention_rate,

    -- Enrollment Progress
    sc.total_patients AS enrollment_current,
    COALESCE(st.target_enrollment, 0) AS enrollment_target,
    
    -- Progress Percentage
    CASE 
        WHEN st.target_enrollment > 0 
        THEN ROUND((sc.total_patients::DECIMAL / st.target_enrollment * 100), 1)
        ELSE 0 
    END AS enrollment_percentage,

    NOW() AS last_refreshed

FROM 
    site_counts sc
LEFT JOIN 
    site_targets st ON sc.site_id = st.site_id;

-- Create an index for performance
CREATE INDEX idx_mv_pi_stats_site_id ON mv_pi_dashboard_stats(site_id);
