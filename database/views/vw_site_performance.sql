-- Regular View: Site Performance (uses site_performance table)
CREATE OR REPLACE VIEW vw_site_performance AS
SELECT 
    s.site_id,
    s.institution_name,
    s.trial_id,
    sp.period_start_date,
    sp.period_end_date,
    sp.patients_screened,
    sp.patients_enrolled,
    sp.screen_fail_rate,
    sp.average_screening_days,
    sp.protocol_deviations_count,
    sp.query_resolution_days_avg,
    ROUND(
        sp.patients_enrolled::DECIMAL / 
        NULLIF(sp.patients_screened, 0)::DECIMAL * 100, 2
    ) as screening_success_rate,
    ROUND(
        sp.patients_enrolled::DECIMAL / 
        NULLIF(s.target_enrollment, 0)::DECIMAL * 100, 2
    ) as enrollment_progress
FROM study_sites s
LEFT JOIN site_performance sp ON s.site_id = sp.site_id;