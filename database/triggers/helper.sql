SET search_path TO meditrials;

CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_site_enrollment;
    REFRESH MATERIALIZED VIEW mv_safety_overview;
    REFRESH MATERIALIZED VIEW mv_data_quality;
    REFRESH MATERIALIZED VIEW mv_visit_compliance;
    REFRESH MATERIALIZED VIEW mv_ae_by_arm;
    REFRESH MATERIALIZED VIEW mv_site_performance;
    REFRESH MATERIALIZED VIEW mv_lab_trends;
    REFRESH MATERIALIZED VIEW mv_protocol_deviations_summary;
    REFRESH MATERIALIZED VIEW mv_query_resolution_time;
    REFRESH MATERIALIZED VIEW mv_randomization_balance;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_consent_expiry()
RETURNS void AS $$
BEGIN
    UPDATE patients p
    SET patient_status = 'Reconsent Required'
    FROM informed_consent ic
    WHERE p.patient_id = ic.patient_id
      AND ic.consent_date < CURRENT_DATE - INTERVAL '1 year'
      AND ic.is_withdrawn = FALSE
      AND p.patient_status NOT IN ('Withdrawn', 'Completed', 'Screen Failure');
END;
$$ LANGUAGE plpgsql;
