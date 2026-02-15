-- 1. Site Enrollment Dashboard
CREATE MATERIALIZED VIEW mv_site_enrollment AS
SELECT 
    s.site_id,
    s.institution_name,
    s.trial_id,
    s.target_enrollment,
    s.current_enrollment,
    CASE 
        WHEN s.target_enrollment > 0 
        THEN ROUND((s.current_enrollment::DECIMAL / s.target_enrollment::DECIMAL) * 100, 2)
        ELSE 0 
    END as enrollment_percentage,
    COUNT(DISTINCT p.patient_id) as total_patients,
    COUNT(DISTINCT CASE WHEN p.patient_status = 'Active' THEN p.patient_id END) as active_patients,
    COUNT(DISTINCT CASE WHEN p.patient_status = 'Screen Failure' THEN p.patient_id END) as screen_failures
FROM study_sites s
LEFT JOIN patients p ON s.site_id = p.site_id
GROUP BY s.site_id, s.institution_name, s.trial_id, s.target_enrollment, s.current_enrollment;
