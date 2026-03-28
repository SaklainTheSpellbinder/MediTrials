-- ============================================================
-- 007_dm_function.sql  — Data Manager quality-score function
-- Called by: GET /api/data-management/sites/:siteId/quality-score
-- Used in : eCRF Completeness page (per-site score column)
--           Data Manager Dashboard site comparison table
-- Run once against the meditrials database AFTER 006_seed (if any).
-- ============================================================
SET search_path TO meditrials;

DROP FUNCTION IF EXISTS get_site_data_quality_score(INTEGER) CASCADE;

-- Function: get_site_data_quality_score
-- Returns a composite quality score (0-100) for a given site.
-- Score formula: 70% weight on form completion rate + 30% weight on low query burden.
CREATE OR REPLACE FUNCTION get_site_data_quality_score(p_site_id INTEGER)
RETURNS TABLE(
    site_id              INTEGER,
    total_forms          INTEGER,
    completed_forms      INTEGER,
    signed_forms         INTEGER,
    open_queries         INTEGER,
    completion_rate      DECIMAL,
    query_burden_rate    DECIMAL,
    quality_score        DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p_site_id,
        -- Total distinct eCRF form instances across all patients at this site
        COUNT(DISTINCT ed.ecrf_instance_id)::INTEGER                                           AS total_forms,

        -- Forms in a 'done' state: Completed, Signed, or Locked
        COUNT(DISTINCT ed.ecrf_instance_id)
            FILTER (WHERE ed.form_status IN ('Completed','Signed','Locked'))::INTEGER          AS completed_forms,

        -- Strictly 'Signed' forms (investigator has reviewed)
        COUNT(DISTINCT ed.ecrf_instance_id)
            FILTER (WHERE ed.form_status = 'Signed')::INTEGER                                  AS signed_forms,

        -- Open data queries flagging data issues at this site
        COUNT(DISTINCT dq.query_id)
            FILTER (WHERE dq.query_status = 'Open')::INTEGER                                   AS open_queries,

        -- Form completion rate (0-100 %)
        ROUND(
            COUNT(DISTINCT ed.ecrf_instance_id)
                FILTER (WHERE ed.form_status IN ('Completed','Signed','Locked'))::DECIMAL
            / NULLIF(COUNT(DISTINCT ed.ecrf_instance_id), 0) * 100
        , 2)                                                                                    AS completion_rate,

        -- Query burden rate = open queries per form (0-100 %)
        ROUND(
            COUNT(DISTINCT dq.query_id)
                FILTER (WHERE dq.query_status = 'Open')::DECIMAL
            / NULLIF(COUNT(DISTINCT ed.ecrf_instance_id), 0) * 100
        , 2)                                                                                    AS query_burden_rate,

        -- Composite quality score:
        --   70% from completion rate + up to 30% bonus for low query burden
        ROUND(
            (
                -- Completion component (max 70 pts)
                COUNT(DISTINCT ed.ecrf_instance_id)
                    FILTER (WHERE ed.form_status IN ('Completed','Signed','Locked'))::DECIMAL
                / NULLIF(COUNT(DISTINCT ed.ecrf_instance_id), 0) * 70
            )
            +
            (
                -- Query-burden component (max 30 pts — deduct for high query burden)
                GREATEST(0, 30 - (
                    COUNT(DISTINCT dq.query_id)
                        FILTER (WHERE dq.query_status = 'Open')::DECIMAL
                    / NULLIF(COUNT(DISTINCT ed.ecrf_instance_id), 0) * 100
                ))
            )
        , 2)                                                                                    AS quality_score

    FROM patients p
    JOIN patient_visits     pv  ON pv.patient_id         = p.patient_id
    LEFT JOIN ecrf_data     ed  ON ed.visit_instance_id  = pv.visit_instance_id
    LEFT JOIN data_queries  dq  ON dq.ecrf_instance_id   = ed.ecrf_instance_id
    WHERE p.site_id = p_site_id;
END;
$$ LANGUAGE plpgsql;
