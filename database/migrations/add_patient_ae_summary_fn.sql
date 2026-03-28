-- Migration: add get_patient_ae_summary function
-- Run this once against the meditrials schema

CREATE OR REPLACE FUNCTION meditrials.get_patient_ae_summary(p_patient_id INTEGER)
RETURNS TABLE(
    total_ae INTEGER,
    serious_ae INTEGER,
    max_severity INTEGER,
    has_death BOOLEAN,
    most_recent_ae_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(ae.ae_id)::INTEGER,
        COUNT(ae.ae_id) FILTER (WHERE ae.ae_id IN (
            SELECT ae_id FROM meditrials.serious_adverse_events
        ))::INTEGER,
        MAX(ae.severity_grade)::INTEGER,
        BOOL_OR(ae.results_in_death),
        MAX(ae.ae_start_date)
    FROM meditrials.adverse_events ae
    WHERE ae.patient_id = p_patient_id;
END;
$$ LANGUAGE plpgsql;
