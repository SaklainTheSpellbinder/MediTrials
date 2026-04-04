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
CREATE OR REPLACE FUNCTION public.get_site_data_quality_score(p_site_id INTEGER)
RETURNS TABLE(
    site_id             INTEGER,
    institution_name    VARCHAR,
    total_forms         INTEGER,
    completed_forms     INTEGER,
    signed_forms        INTEGER,
    open_queries        INTEGER,
    completion_rate     NUMERIC,
    query_burden_rate   NUMERIC,
    quality_score       NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ss.site_id::INTEGER,
        ss.institution_name,

        COUNT(DISTINCT ed.ecrf_instance_id)::INTEGER                                            AS total_forms,

        COUNT(DISTINCT ed.ecrf_instance_id)
            FILTER (WHERE ed.form_status IN ('Completed','Signed','Locked'))::INTEGER           AS completed_forms,

        COUNT(DISTINCT ed.ecrf_instance_id)
            FILTER (WHERE ed.form_status = 'Signed')::INTEGER                                   AS signed_forms,

        COUNT(DISTINCT dq.query_id)
            FILTER (WHERE dq.query_status = 'Open')::INTEGER                                    AS open_queries,

        ROUND(
            COUNT(DISTINCT ed.ecrf_instance_id)
                FILTER (WHERE ed.form_status IN ('Completed','Signed','Locked'))::DECIMAL
            / NULLIF(COUNT(DISTINCT ed.ecrf_instance_id), 0) * 100
        , 2)                                                                                     AS completion_rate,

        ROUND(
            COUNT(DISTINCT dq.query_id)
                FILTER (WHERE dq.query_status = 'Open')::DECIMAL
            / NULLIF(COUNT(DISTINCT ed.ecrf_instance_id), 0) * 100
        , 2)                                                                                     AS query_burden_rate,

        ROUND(
            (
                COUNT(DISTINCT ed.ecrf_instance_id)
                    FILTER (WHERE ed.form_status IN ('Completed','Signed','Locked'))::DECIMAL
                / NULLIF(COUNT(DISTINCT ed.ecrf_instance_id), 0) * 70
            )
            +
            GREATEST(0, 30 - (
                COUNT(DISTINCT dq.query_id)
                    FILTER (WHERE dq.query_status = 'Open')::DECIMAL
                / NULLIF(COUNT(DISTINCT ed.ecrf_instance_id), 0) * 100
            ))
        , 2)                                                                                     AS quality_score

    FROM public.study_sites ss
    LEFT JOIN public.patients p    ON p.site_id             = ss.site_id
    LEFT JOIN public.patient_visits pv ON pv.patient_id     = p.patient_id
    LEFT JOIN public.ecrf_data ed  ON ed.visit_instance_id  = pv.visit_instance_id
    LEFT JOIN public.data_queries dq ON dq.ecrf_instance_id = ed.ecrf_instance_id
    WHERE ss.site_id = p_site_id
    GROUP BY ss.site_id, ss.institution_name;
END;
$$ LANGUAGE plpgsql;

--one more function 
CREATE OR REPLACE FUNCTION public.get_patient_ae_summary(p_patient_id INTEGER)
RETURNS TABLE(
    patient_id              INTEGER,
    trial_patient_id        VARCHAR,
    total_ae                INTEGER,
    grade3plus_ae           INTEGER,
    sae_count               INTEGER,
    open_sae_count          INTEGER,
    deaths                  INTEGER,
    life_threatening        INTEGER,
    requires_hospitalization INTEGER,
    treatment_related_count INTEGER,
    most_recent_ae_date     DATE,
    most_severe_grade       INTEGER,
    ae_by_term              JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.patient_id::INTEGER,
        p.trial_patient_id,

        COUNT(DISTINCT ae.ae_id)::INTEGER                                              AS total_ae,

        COUNT(DISTINCT ae.ae_id)
            FILTER (WHERE ae.severity_grade >= 3)::INTEGER                             AS grade3plus_ae,

        COUNT(DISTINCT sae.sae_id)::INTEGER                                            AS sae_count,

        COUNT(DISTINCT sae.sae_id)
            FILTER (WHERE sae.sae_status NOT IN ('Reported','Closed'))::INTEGER        AS open_sae_count,

        COUNT(DISTINCT ae.ae_id)
            FILTER (WHERE ae.results_in_death = TRUE)::INTEGER                         AS deaths,

        COUNT(DISTINCT ae.ae_id)
            FILTER (WHERE ae.life_threatening = TRUE)::INTEGER                         AS life_threatening,

        COUNT(DISTINCT ae.ae_id)
            FILTER (WHERE ae.requires_hospitalization = TRUE)::INTEGER                 AS requires_hospitalization,

        COUNT(DISTINCT ae.ae_id)
            FILTER (WHERE ae.treatment_related = TRUE)::INTEGER                        AS treatment_related_count,

        MAX(ae.ae_start_date)                                                          AS most_recent_ae_date,

        MAX(ae.severity_grade)::INTEGER                                                AS most_severe_grade,

        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'ae_term',              ae.ae_term,
                    'severity_grade',       ae.severity_grade,
                    'ae_start_date',        ae.ae_start_date,
                    'outcome',              ae.outcome,
                    'causality',            ae.causality_relationship,
                    'treatment_related',    ae.treatment_related,
                    'is_sae',               sae.sae_id IS NOT NULL
                ) ORDER BY ae.ae_start_date DESC
            ) FILTER (WHERE ae.ae_id IS NOT NULL),
            '[]'::JSONB
        )                                                                              AS ae_by_term

    FROM public.patients p
    LEFT JOIN public.adverse_events       ae  ON ae.patient_id  = p.patient_id
    LEFT JOIN public.serious_adverse_events sae ON sae.ae_id    = ae.ae_id
    WHERE p.patient_id = p_patient_id
    GROUP BY p.patient_id, p.trial_patient_id;
END;
$$ LANGUAGE plpgsql;

-- 1. Create a dedicated sequence for the ID
CREATE SEQUENCE IF NOT EXISTS public.patients_trial_id_seq START 9;

-- 2. Create the trigger function
CREATE OR REPLACE FUNCTION public.generate_trial_patient_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Only generate if the backend didn't manually provide one
    IF NEW.trial_patient_id IS NULL OR NEW.trial_patient_id = '' THEN
        NEW.trial_patient_id := 'PT-' || LPAD((nextval('public.patients_trial_id_seq'))::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach the trigger to the patients table
CREATE OR REPLACE TRIGGER trg_trial_patient_id
BEFORE INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.generate_trial_patient_id();

SELECT setval('public.patients_trial_id_seq', 107);



-------
CREATE OR REPLACE FUNCTION public.calculate_ae_incidence_rates(p_trial_id INTEGER)
RETURNS TABLE(
    arm_code        VARCHAR,
    ae_term         VARCHAR,
    event_count     INTEGER,
    patient_years   NUMERIC,
    rate_per_100py  NUMERIC,
    incidence_pct   NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH arm_exposure AS (
        SELECT
            ta.arm_id,
            ta.arm_code,
            COUNT(DISTINCT ra.patient_id)                                   AS n_patients,
            SUM(
                EXTRACT(DAY FROM
                    -- For completed/withdrawn patients use updated_at as proxy end date,
                    -- for active/enrolled patients use today
                    CASE
                        WHEN p.patient_status IN ('Completed', 'Withdrawn')
                        THEN COALESCE(p.updated_at::DATE, CURRENT_DATE)
                        ELSE CURRENT_DATE
                    END
                    - COALESCE(p.enrollment_date, CURRENT_DATE)
                ) / 365.25
            )                                                               AS total_patient_years
        FROM public.treatment_arms ta
        JOIN public.randomization_assignments ra ON ra.arm_id = ta.arm_id
        JOIN public.patients p ON p.patient_id = ra.patient_id
        WHERE ta.trial_id = p_trial_id
          AND p.enrollment_date IS NOT NULL   -- exclude patients never actually enrolled
        GROUP BY ta.arm_id, ta.arm_code
    ),
    ae_counts AS (
        SELECT
            ta.arm_id,
            aev.ae_term,
            COUNT(DISTINCT aev.ae_id)       AS event_count,
            COUNT(DISTINCT aev.patient_id)  AS patient_count
        FROM public.adverse_events aev
        JOIN public.patients p ON p.patient_id = aev.patient_id
        JOIN public.randomization_assignments ra ON ra.patient_id = p.patient_id
        JOIN public.treatment_arms ta ON ta.arm_id = ra.arm_id
        WHERE ta.trial_id = p_trial_id
        GROUP BY ta.arm_id, aev.ae_term
    )
    SELECT
        exp.arm_code,
        ac.ae_term,
        ac.event_count::INTEGER,
        ROUND(exp.total_patient_years::NUMERIC, 2),
        ROUND((ac.event_count::NUMERIC / NULLIF(exp.total_patient_years, 0) * 100)::NUMERIC, 3),
        ROUND((ac.patient_count::NUMERIC / NULLIF(exp.n_patients, 0) * 100)::NUMERIC, 2)
    FROM ae_counts ac
    JOIN arm_exposure exp ON exp.arm_id = ac.arm_id
    ORDER BY ac.event_count DESC;
END;
$$ LANGUAGE plpgsql;
