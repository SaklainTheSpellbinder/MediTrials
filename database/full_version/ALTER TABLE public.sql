ALTER TABLE public.adverse_events 
  ADD COLUMN outcome VARCHAR(50) CHECK (outcome IN ('Recovered', 'Recovering', 'Not Recovered', 'Fatal', 'Unknown'));


ALTER TABLE public.serious_adverse_events 
  ADD COLUMN narrative_text TEXT,
  ADD COLUMN fda_submitted_date DATE,
  ADD COLUMN ema_submitted_date DATE,
  ADD COLUMN irb_submitted_date DATE;



ALTER TABLE public.safety_alerts ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;


ALTER TABLE adverse_events ADD COLUMN IF NOT EXISTS ae_status VARCHAR(50) DEFAULT 'Active'
    CHECK (ae_status IN ('Active', 'Resolved', 'Ongoing', 'Unknown'));


    ALTER TABLE randomization_assignments
    ADD COLUMN IF NOT EXISTS unblinded_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS unblinded_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL;


    CREATE OR REPLACE PROCEDURE sp_unblind_patient(
    p_patient_id          INTEGER,
    p_reason              TEXT,
    p_requested_by_user_id INTEGER,
    INOUT treatment_arm   VARCHAR DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    -- Authorization check
    IF NOT EXISTS (
        SELECT 1 FROM users
         WHERE user_id  = p_requested_by_user_id
           AND role     IN ('Safety_Monitor', 'Principal_Investigator')
           AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'User % is not authorized to perform unblinding.', p_requested_by_user_id;
    END IF;

    -- Retrieve treatment arm
    SELECT ta.arm_code
      INTO treatment_arm
      FROM randomization_assignments ra
      JOIN treatment_arms ta ON ta.arm_id = ra.arm_id
     WHERE ra.patient_id = p_patient_id;

    IF treatment_arm IS NULL THEN
        RAISE EXCEPTION 'Patient % has not been randomized.', p_patient_id;
    END IF;

    -- Check not already unblinded
    IF EXISTS (
        SELECT 1 FROM randomization_assignments
         WHERE patient_id      = p_patient_id
           AND unblinding_date IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Patient % has already been unblinded.', p_patient_id;
    END IF;

    -- Record unblinding date
    UPDATE randomization_assignments
       SET unblinding_date = CURRENT_DATE,
       unblinded_at            = CURRENT_TIMESTAMP,
       unblinded_by_user_id    = p_requested_by_user_id
     WHERE patient_id = p_patient_id;

    -- Audit / alert
    INSERT INTO safety_alerts (
        patient_id,
        source_type,
        source_table,
        source_record_id,
        alert_code,
        alert_message,
        alert_severity
    ) VALUES (
        p_patient_id,
        'OTHER',
        'randomization_assignments',
        p_patient_id,
        'UNBLINDING',
        'Patient ' || p_patient_id || ' unblinded to arm "' || treatment_arm ||
            '". Requested by user ' || p_requested_by_user_id ||
            '. Reason: ' || p_reason,
        'WARNING'
    );

    RAISE NOTICE 'Patient % unblinded to arm: %.', p_patient_id, treatment_arm;
END;
$$;


-- Run this once
ALTER TABLE public.treatment_arms
    ADD COLUMN IF NOT EXISTS is_control BOOLEAN NOT NULL DEFAULT FALSE;

-- Example: mark the arm with 'PLACEBO' or 'ARM_B' or whatever your control arm is
UPDATE public.treatment_arms SET is_control = TRUE WHERE arm_code = 'ARM_B';






CREATE OR REPLACE PROCEDURE public.sp_detect_safety_signals(
    p_trial_id    INTEGER,
    INOUT signals JSONB DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_treatment_patients INTEGER;
    v_control_patients   INTEGER;
BEGIN
    -- Count distinct patients per arm type for this trial
    SELECT
        COUNT(DISTINCT ra.patient_id) FILTER (WHERE ta.is_control = FALSE),
        COUNT(DISTINCT ra.patient_id) FILTER (WHERE ta.is_control = TRUE)
    INTO v_treatment_patients, v_control_patients
    FROM public.randomization_assignments ra
    JOIN public.treatment_arms ta ON ta.arm_id = ra.arm_id
    WHERE ta.trial_id = p_trial_id;

    -- Bail out early if either arm has no patients — PRR undefined
    IF COALESCE(v_treatment_patients, 0) = 0 OR COALESCE(v_control_patients, 0) = 0 THEN
        signals := '[]'::JSONB;
        RETURN;
    END IF;

    WITH ae_counts AS (
        SELECT
            ae.ae_term,
            COUNT(DISTINCT ae.ae_id)                                            AS total_count,
            COUNT(DISTINCT ae.ae_id) FILTER (WHERE ta.is_control = FALSE)       AS treatment_count,
            COUNT(DISTINCT ae.ae_id) FILTER (WHERE ta.is_control = TRUE)        AS control_count
        FROM public.adverse_events      ae
        JOIN public.patients             p  ON p.patient_id  = ae.patient_id
        JOIN public.study_sites          ss ON ss.site_id     = p.site_id
        LEFT JOIN public.randomization_assignments ra ON ra.patient_id = p.patient_id
        LEFT JOIN public.treatment_arms  ta ON ta.arm_id = ra.arm_id
        WHERE ss.trial_id = p_trial_id
        GROUP BY ae.ae_term
        HAVING COUNT(DISTINCT ae.ae_id) >= 2  -- minimum occurrence threshold
    ),
    prr_calc AS (
        SELECT
            ac.ae_term,
            ac.total_count,
            ac.treatment_count,
            ac.control_count,
            -- True PRR with per-arm patient denominators
            ROUND(
                (ac.treatment_count::DECIMAL / v_treatment_patients)
                /
                NULLIF(ac.control_count::DECIMAL / v_control_patients, 0),
                2
            ) AS prr,
            -- Chi-square-style signal classification:
            -- HIGH  = PRR >= 2 AND treatment_count >= 3
            -- MEDIUM = PRR >= 1.5 OR treatment_count >= 2
            -- LOW = everything else above threshold
            CASE
                WHEN ROUND(
                    (ac.treatment_count::DECIMAL / v_treatment_patients)
                    / NULLIF(ac.control_count::DECIMAL / v_control_patients, 0), 2
                ) >= 2 AND ac.treatment_count >= 3                    THEN 'HIGH'
                WHEN ROUND(
                    (ac.treatment_count::DECIMAL / v_treatment_patients)
                    / NULLIF(ac.control_count::DECIMAL / v_control_patients, 0), 2
                ) >= 1.5 OR ac.treatment_count >= 2                   THEN 'MEDIUM'
                ELSE 'LOW'
            END AS signal_strength
        FROM ae_counts ac
        -- Exclude terms with zero control events — PRR is undefined (not just NULL)
        WHERE ac.control_count > 0
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'ae_term',          p.ae_term,
                'total_count',      p.total_count,
                'treatment_count',  p.treatment_count,
                'control_count',    p.control_count,
                'prr',              p.prr,
                'signal_strength',  p.signal_strength
            )
            ORDER BY p.prr DESC NULLS LAST
        ),
        '[]'::JSONB
    )
    INTO signals
    FROM prr_calc p;
END;
$$;

SET search_path TO public;


CREATE OR REPLACE PROCEDURE public.sp_unblind_patient(
    p_patient_id           INTEGER,
    p_reason               TEXT,
    p_requested_by_user_id INTEGER,
    INOUT treatment_arm    VARCHAR DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    -- 1. Authorization check first — cheapest gate
    IF NOT EXISTS (
        SELECT 1 FROM public.users
         WHERE user_id  = p_requested_by_user_id
           AND role     IN ('Safety_Monitor', 'Principal_Investigator')
           AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'User % is not authorized to perform unblinding.', p_requested_by_user_id;
    END IF;

    -- 2. Must be randomized
    IF NOT EXISTS (
        SELECT 1 FROM public.randomization_assignments
         WHERE patient_id = p_patient_id
    ) THEN
        RAISE EXCEPTION 'Patient % has not been randomized.', p_patient_id;
    END IF;

    -- 3. Must not already be unblinded — check BEFORE touching anything
    IF EXISTS (
        SELECT 1 FROM public.randomization_assignments
         WHERE patient_id      = p_patient_id
           AND unblinding_date IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Patient % has already been unblinded.', p_patient_id;
    END IF;

    -- 4. Now safe to fetch and set
    SELECT ta.arm_code
      INTO treatment_arm
      FROM public.randomization_assignments ra
      JOIN public.treatment_arms ta ON ta.arm_id = ra.arm_id
     WHERE ra.patient_id = p_patient_id;

    -- 5. Record unblinding (uses the new columns from bug 3 fix)
    UPDATE public.randomization_assignments
       SET unblinding_date         = CURRENT_DATE,
           unblinded_at            = CURRENT_TIMESTAMP,
           unblinded_by_user_id    = p_requested_by_user_id
     WHERE patient_id = p_patient_id;

    -- 6. Audit alert
    INSERT INTO public.safety_alerts (
        patient_id, source_type, source_table, source_record_id,
        alert_code, alert_message, alert_severity
    ) VALUES (
        p_patient_id, 'OTHER', 'randomization_assignments', p_patient_id,
        'UNBLINDING',
        'Patient ' || p_patient_id || ' unblinded to arm "' || treatment_arm ||
            '". Requested by user ' || p_requested_by_user_id ||
            '. Reason: ' || p_reason,
        'WARNING'
    );

    RAISE NOTICE 'Patient % unblinded to arm: %.', p_patient_id, treatment_arm;
END;
$$;




DROP SCHEMA IF EXISTS meditrials CASCADE;





CREATE OR REPLACE FUNCTION public.update_site_enrollment()
RETURNS TRIGGER AS $$
BEGIN
    -- The set of statuses that count as "enrolled" for the counter
    -- Adjust this set if your trial uses different active statuses
    IF TG_OP = 'INSERT' THEN
        -- Only count if the patient is being inserted already enrolled/active
        -- (rare, but possible for data migrations)
        IF NEW.patient_status IN ('Enrolled', 'Active') THEN
            UPDATE public.study_sites
               SET current_enrollment = current_enrollment + 1,
                   updated_at         = CURRENT_TIMESTAMP
             WHERE site_id = NEW.site_id;
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Case 1: patient moved to an enrolled status (wasn't before)
        IF NEW.patient_status IN ('Enrolled', 'Active')
           AND OLD.patient_status NOT IN ('Enrolled', 'Active') THEN
            UPDATE public.study_sites
               SET current_enrollment = current_enrollment + 1,
                   updated_at         = CURRENT_TIMESTAMP
             WHERE site_id = NEW.site_id;

        -- Case 2: patient left an enrolled status (withdrawn, completed, etc.)
        ELSIF OLD.patient_status IN ('Enrolled', 'Active')
              AND NEW.patient_status NOT IN ('Enrolled', 'Active') THEN
            UPDATE public.study_sites
               SET current_enrollment = GREATEST(current_enrollment - 1, 0),
                   updated_at         = CURRENT_TIMESTAMP
             WHERE site_id = NEW.site_id;

        -- Case 3: patient moved between sites (keep same status logic)
        ELSIF OLD.site_id IS DISTINCT FROM NEW.site_id THEN
            -- Only adjust counts if this patient was actually enrolled
            IF OLD.patient_status IN ('Enrolled', 'Active') THEN
                UPDATE public.study_sites
                   SET current_enrollment = GREATEST(current_enrollment - 1, 0),
                       updated_at         = CURRENT_TIMESTAMP
                 WHERE site_id = OLD.site_id;

                IF NEW.patient_status IN ('Enrolled', 'Active') THEN
                    UPDATE public.study_sites
                       SET current_enrollment = current_enrollment + 1,
                           updated_at         = CURRENT_TIMESTAMP
                     WHERE site_id = NEW.site_id;
                END IF;
            END IF;
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        -- Only decrement if the deleted patient was enrolled
        IF OLD.patient_status IN ('Enrolled', 'Active') THEN
            UPDATE public.study_sites
               SET current_enrollment = GREATEST(current_enrollment - 1, 0),
                   updated_at         = CURRENT_TIMESTAMP
             WHERE site_id = OLD.site_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;




UPDATE public.study_sites ss
   SET current_enrollment = (
       SELECT COUNT(*)
         FROM public.patients p
        WHERE p.site_id = ss.site_id
          AND p.patient_status IN ('Enrolled', 'Active')
   );



ALTER TABLE public.patients ADD COLUMN full_name VARCHAR(255);




ALTER TABLE public.dsmb_meetings
    ADD COLUMN IF NOT EXISTS summary_notes TEXT,
    ADD COLUMN IF NOT EXISTS recorded_by_user_id INTEGER REFERENCES public.users(user_id) ON DELETE SET NULL;


SELECT proname, prokind FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' ORDER BY proname;




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

DROP FUNCTION IF EXISTS public.get_site_data_quality_score(INTEGER);

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



DROP MATERIALIZED VIEW IF EXISTS public.mv_site_performance;

CREATE MATERIALIZED VIEW public.mv_site_performance AS
SELECT
    ss.site_id,
    ss.institution_name,
    ss.trial_id,
    ss.country,
    ss.target_enrollment,

    -- Date range of activity at this site
    MIN(ps.screening_date)                                                          AS period_start_date,
    MAX(COALESCE(p.enrollment_date, ps.screening_date::DATE))                       AS period_end_date,

    -- Screened = any patient with a screening record at this site
    COUNT(DISTINCT ps.patient_id)                                                   AS patients_screened,

    -- Enrolled = patients who reached an active/enrolled/completed state
    COUNT(DISTINCT p.patient_id)
        FILTER (WHERE p.patient_status IN ('Enrolled', 'Active', 'Completed'))      AS patients_enrolled,

    -- Screen fail rate = failed screenings / total screened
    ROUND(
        COUNT(DISTINCT ps.patient_id)
            FILTER (WHERE ps.screening_status = 'Failed')::DECIMAL
        / NULLIF(COUNT(DISTINCT ps.patient_id), 0) * 100
    , 2)                                                                            AS screen_fail_rate,

    -- Average days from screening to enrollment
ROUND(
    AVG(
        (p.enrollment_date - ps.screening_date)
    ) FILTER (
        WHERE p.enrollment_date IS NOT NULL
          AND ps.screening_date IS NOT NULL
    )::DECIMAL
, 1)                                                                            AS average_screening_days,
    -- Protocol deviations at this site
    COUNT(DISTINCT pd.deviation_id)                                                 AS protocol_deviations_count,

    -- Average query resolution time in days
    ROUND(
        AVG(
            EXTRACT(EPOCH FROM (dq.resolved_date - dq.raised_date)) / 86400.0
        ) FILTER (WHERE dq.resolved_date IS NOT NULL)::DECIMAL
    , 1)                                                                            AS query_resolution_days_avg,

    -- Screening success rate = enrolled / screened
    ROUND(
        COUNT(DISTINCT p.patient_id)
            FILTER (WHERE p.patient_status IN ('Enrolled', 'Active', 'Completed'))::DECIMAL
        / NULLIF(COUNT(DISTINCT ps.patient_id), 0) * 100
    , 2)                                                                            AS screening_success_rate,

    -- Enrollment progress vs target
    ROUND(
        COUNT(DISTINCT p.patient_id)
            FILTER (WHERE p.patient_status IN ('Enrolled', 'Active', 'Completed'))::DECIMAL
        / NULLIF(ss.target_enrollment, 0) * 100
    , 2)                                                                            AS enrollment_progress_pct

FROM public.study_sites                 ss
LEFT JOIN public.patients               p   ON p.site_id              = ss.site_id
LEFT JOIN public.patient_screening      ps  ON ps.patient_id          = p.patient_id
LEFT JOIN public.protocol_deviations    pd  ON pd.patient_id          = p.patient_id
LEFT JOIN public.patient_visits         pv  ON pv.patient_id          = p.patient_id
LEFT JOIN public.ecrf_data              ed  ON ed.visit_instance_id   = pv.visit_instance_id
LEFT JOIN public.data_queries           dq  ON dq.ecrf_instance_id    = ed.ecrf_instance_id
GROUP BY ss.site_id, ss.institution_name, ss.trial_id, ss.country, ss.target_enrollment;

-- Index for fast trial-based lookups
CREATE INDEX IF NOT EXISTS idx_mv_site_performance_trial
    ON public.mv_site_performance (trial_id);

CREATE INDEX IF NOT EXISTS idx_mv_site_performance_site
    ON public.mv_site_performance (site_id);


DROP VIEW IF EXISTS public.vw_site_performance;

CREATE OR REPLACE VIEW public.vw_site_performance AS
SELECT
    ss.site_id,
    ss.institution_name,
    ss.trial_id,
    ss.country,
    ss.target_enrollment,

    MIN(ps.screening_date)                                                          AS period_start_date,
    MAX(COALESCE(p.enrollment_date, ps.screening_date::DATE))                       AS period_end_date,

    COUNT(DISTINCT ps.patient_id)                                                   AS patients_screened,

    COUNT(DISTINCT p.patient_id)
        FILTER (WHERE p.patient_status IN ('Enrolled', 'Active', 'Completed'))      AS patients_enrolled,

    ROUND(
        COUNT(DISTINCT ps.patient_id)
            FILTER (WHERE ps.screening_status = 'Failed')::DECIMAL
        / NULLIF(COUNT(DISTINCT ps.patient_id), 0) * 100
    , 2)                                                                            AS screen_fail_rate,

    ROUND(
    AVG(p.enrollment_date - ps.screening_date)
    FILTER (WHERE p.enrollment_date IS NOT NULL AND ps.screening_date IS NOT NULL)
    ::DECIMAL
, 2)                                                                            AS average_screening_days,

    COUNT(DISTINCT pd.deviation_id)                                                 AS protocol_deviations_count,

    ROUND(
        AVG(EXTRACT(EPOCH FROM (dq.resolved_date - dq.raised_date)) / 86400.0)
        FILTER (WHERE dq.resolved_date IS NOT NULL)::DECIMAL
    , 2)                                                                            AS query_resolution_days_avg,

    ROUND(
        COUNT(DISTINCT p.patient_id)
            FILTER (WHERE p.patient_status IN ('Enrolled', 'Active', 'Completed'))::DECIMAL
        / NULLIF(COUNT(DISTINCT ps.patient_id), 0) * 100
    , 2)                                                                            AS screening_success_rate,

    ROUND(
        COUNT(DISTINCT p.patient_id)
            FILTER (WHERE p.patient_status IN ('Enrolled', 'Active', 'Completed'))::DECIMAL
        / NULLIF(ss.target_enrollment, 0) * 100
    , 2)                                                                            AS enrollment_progress_pct

FROM public.study_sites                 ss
LEFT JOIN public.patients               p   ON p.site_id              = ss.site_id
LEFT JOIN public.patient_screening      ps  ON ps.patient_id          = p.patient_id
LEFT JOIN public.protocol_deviations    pd  ON pd.patient_id          = p.patient_id
LEFT JOIN public.patient_visits         pv  ON pv.patient_id          = p.patient_id
LEFT JOIN public.ecrf_data              ed  ON ed.visit_instance_id   = pv.visit_instance_id
LEFT JOIN public.data_queries           dq  ON dq.ecrf_instance_id    = ed.ecrf_instance_id
GROUP BY ss.site_id, ss.institution_name, ss.trial_id, ss.country, ss.target_enrollment;








ALTER TABLE public.user_access_log DROP CONSTRAINT user_access_log_access_type_check;

ALTER TABLE public.user_access_log ADD CONSTRAINT user_access_log_access_type_check 
CHECK (access_type IN ('VIEW', 'EDIT', 'DELETE', 'EXPORT', 'SIGN', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT'));





SELECT * from safety_alerts;









-- 1. How many AEs exist total?
SELECT COUNT(*) FROM public.adverse_events;

-- 2. Are they linked to valid patients/sites/trials?
SELECT COUNT(DISTINCT ae.ae_id)
FROM public.adverse_events ae
JOIN public.patients p ON p.patient_id = ae.patient_id
JOIN public.study_sites ss ON ss.site_id = p.site_id
JOIN public.clinical_trials ct ON ct.trial_id = ss.trial_id;

-- 3. What date range are they in?
SELECT MIN(ae_start_date), MAX(ae_start_date) FROM public.adverse_events;

-- 4. Are the MVs stale?
SELECT total_ae, grade3plus_ae FROM public.mv_safety_overview;

-- 5. How many AEs are in the last 30 days (the chart filter)?
SELECT COUNT(*) FROM public.adverse_events
WHERE ae_start_date >= NOW() - INTERVAL '30 days';








CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR PRIMARY KEY, 
    value JSONB,
    updated_by INTEGER REFERENCES public.users(user_id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Optional but good practice: Add an audit comment
COMMENT ON TABLE public.system_settings IS 'Global system configuration parameters';







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







CREATE OR REPLACE PROCEDURE public.sp_lock_database(

    p_trial_id          INTEGER,

    p_lock_type         VARCHAR,

    p_locked_by_user_id INTEGER

)

LANGUAGE plpgsql AS $$

DECLARE

    v_snapshot_hash TEXT;

BEGIN

    -- Validate lock type (mirrors CHECK constraint on data_locks)

    IF p_lock_type NOT IN ('Interim', 'Final', 'Database', 'Partial') THEN

        RAISE EXCEPTION 'Invalid lock type: %. Must be Interim, Final, Database, or Partial.', p_lock_type;

    END IF;



    -- Check no active lock already exists

    IF EXISTS (

        SELECT 1 FROM data_locks

         WHERE trial_id   = p_trial_id

           AND unlock_date IS NULL

    ) THEN

        RAISE EXCEPTION 'Trial % already has an active data lock.', p_trial_id;

    END IF;



    -- CRITICAL FIX: Snapshot fingerprint now perfectly matches the Node.js /verify route.

    -- It aggregates the exact patient data row-by-row into a JSON string and hashes it.

    SELECT MD5(COALESCE(

        (

            SELECT json_agg(row_to_json(p.*) ORDER BY p.patient_id)::TEXT

            FROM public.patients p

            JOIN public.study_sites ss ON ss.site_id = p.site_id

            WHERE ss.trial_id = p_trial_id

        ), 

        ''

    )) INTO v_snapshot_hash;



    INSERT INTO data_locks (

        trial_id,

        lock_type,

        locked_by_user_id,

        snapshot_hash

    ) VALUES (

        p_trial_id,

        p_lock_type,

        p_locked_by_user_id,

        v_snapshot_hash

    );



    RAISE NOTICE 'Trial % locked (%). Snapshot hash: %', p_trial_id, p_lock_type, v_snapshot_hash;

END;

$$;



SELECT column_name FROM information_schema.columns 
WHERE table_name = 'patients' AND table_schema = 'public';


ALTER TABLE public.patients 
    ADD COLUMN IF NOT EXISTS completion_date DATE;


CREATE OR REPLACE FUNCTION public.set_patient_completion_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.patient_status IN ('Completed', 'Withdrawn')
       AND OLD.patient_status NOT IN ('Completed', 'Withdrawn')
    THEN
        NEW.completion_date := CURRENT_DATE;
    END IF;
    IF NEW.patient_status NOT IN ('Completed', 'Withdrawn')
       AND OLD.patient_status IN ('Completed', 'Withdrawn')
    THEN
        NEW.completion_date := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_patient_completion_date
BEFORE UPDATE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.set_patient_completion_date();

-- Backfill existing completed/withdrawn patients
UPDATE public.patients
   SET completion_date = updated_at::DATE
 WHERE patient_status IN ('Completed', 'Withdrawn')
   AND completion_date IS NULL;



CREATE OR REPLACE PROCEDURE public.sp_calculate_survival(
    p_trial_id      INTEGER,
    p_endpoint_type VARCHAR DEFAULT 'Overall Survival'
)
LANGUAGE plpgsql AS $$
DECLARE
    v_time_points      JSONB;
    v_survival_probs   JSONB;
    v_hazard_ratio     NUMERIC;
    v_logrank_p        NUMERIC;
    v_ci               VARCHAR(50);
    v_tx_patients      INTEGER;
    v_ctrl_patients    INTEGER;
    v_tx_events        INTEGER;
    v_ctrl_events      INTEGER;
    v_total_patients   INTEGER;
    v_chi2             NUMERIC;
BEGIN

    -- ── Step 1: Patient survival data into temp table ─────────────────────────
    DROP TABLE IF EXISTS _ps;
    CREATE TEMP TABLE _ps AS
    SELECT
        p.patient_id,
        ta.is_control,
        MAX(CASE WHEN ae.results_in_death THEN 1 ELSE 0 END) AS had_event,
        CASE
            WHEN MAX(CASE WHEN ae.results_in_death THEN 1 ELSE 0 END) = 1
            THEN MIN(ae.ae_start_date) FILTER (WHERE ae.results_in_death)
                 - p.enrollment_date
            ELSE CASE
                WHEN p.patient_status IN ('Completed','Withdrawn')
                THEN p.updated_at::DATE - p.enrollment_date
                ELSE CURRENT_DATE - p.enrollment_date
            END
        END AS days_observed
    FROM public.patients p
    JOIN public.study_sites ss          ON ss.site_id  = p.site_id
    JOIN public.randomization_assignments ra ON ra.patient_id = p.patient_id
    JOIN public.treatment_arms ta       ON ta.arm_id   = ra.arm_id
    LEFT JOIN public.adverse_events ae  ON ae.patient_id = p.patient_id
    WHERE ss.trial_id = p_trial_id
      AND p.enrollment_date IS NOT NULL
      AND p.patient_status IN ('Active','Enrolled','Completed','Withdrawn')
    GROUP BY p.patient_id, ta.is_control, p.patient_status, p.updated_at, p.enrollment_date;

    -- ── Step 2: KM survival probabilities at fixed time points ────────────────
    DROP TABLE IF EXISTS _km;
    CREATE TEMP TABLE _km AS
    SELECT
        t,
        COUNT(*)                                                        AS total_n,
        COUNT(*) FILTER (WHERE days_observed >= t)                      AS n_at_risk,
        COUNT(*) FILTER (WHERE had_event = 1 AND days_observed <= t)    AS events_by_t,
        ROUND(
            (COUNT(*) - COUNT(*) FILTER (WHERE had_event = 1 AND days_observed <= t))::NUMERIC
            / NULLIF(COUNT(*), 0)
        , 4) AS survival_prob
    FROM _ps
    CROSS JOIN (SELECT unnest(ARRAY[30,60,90,180,365]) AS t) tp
    GROUP BY t
    ORDER BY t;

    -- ── Step 3: Collect time points and survival probs ────────────────────────
    SELECT jsonb_agg(t            ORDER BY t) INTO v_time_points    FROM _km;
    SELECT jsonb_agg(survival_prob ORDER BY t) INTO v_survival_probs FROM _km;

    -- ── Step 4: Per-arm stats ─────────────────────────────────────────────────
    SELECT COUNT(*) FILTER (WHERE NOT is_control),
           COUNT(*) FILTER (WHERE is_control),
           SUM(had_event) FILTER (WHERE NOT is_control),
           SUM(had_event) FILTER (WHERE is_control),
           COUNT(*)
    INTO v_tx_patients, v_ctrl_patients, v_tx_events, v_ctrl_events, v_total_patients
    FROM _ps;

    -- ── Step 5: Hazard ratio ──────────────────────────────────────────────────
    v_hazard_ratio := ROUND(
        (v_tx_events::NUMERIC   / NULLIF(v_tx_patients, 0))
        /
        NULLIF(v_ctrl_events::NUMERIC / NULLIF(v_ctrl_patients, 0), 0)
    , 3);

    -- ── Step 6: Log-rank p-value (chi-square approximation) ──────────────────
    v_chi2 := POWER(
        v_tx_events - (v_tx_patients::NUMERIC * (v_tx_events + v_ctrl_events)
                       / NULLIF(v_tx_patients + v_ctrl_patients, 0)), 2
    ) / NULLIF(
        v_tx_patients::NUMERIC * (v_tx_events + v_ctrl_events)
        / NULLIF(v_tx_patients + v_ctrl_patients, 0), 0
    );

    v_logrank_p := CASE
        WHEN v_chi2 > 10.83 THEN 0.001
        WHEN v_chi2 > 6.63  THEN 0.01
        WHEN v_chi2 > 3.84  THEN 0.05
        ELSE 0.20
    END;

    -- ── Step 7: 95% CI for HR (Woolf approximation) ──────────────────────────
    SELECT
        ROUND(exp(ln(NULLIF(v_hazard_ratio,0))
            - 1.96 * sqrt(1.0/NULLIF(v_tx_events,0) + 1.0/NULLIF(v_ctrl_events,0)))::NUMERIC, 2)
        || ' - ' ||
        ROUND(exp(ln(NULLIF(v_hazard_ratio,0))
            + 1.96 * sqrt(1.0/NULLIF(v_tx_events,0) + 1.0/NULLIF(v_ctrl_events,0)))::NUMERIC, 2)
    INTO v_ci;

    -- ── Step 8: Cleanup temp tables ───────────────────────────────────────────
    DROP TABLE IF EXISTS _ps;
    DROP TABLE IF EXISTS _km;

    -- ── Step 9: Insert result ─────────────────────────────────────────────────
    INSERT INTO public.survival_analysis (
        trial_id, endpoint_type,
        time_points, survival_probabilities,
        hazard_ratio, logrank_p_value, confidence_interval_95
    ) VALUES (
        p_trial_id, p_endpoint_type,
        COALESCE(v_time_points,    '[30,60,90,180,365]'::JSONB),
        COALESCE(v_survival_probs, '[null,null,null,null,null]'::JSONB),
        v_hazard_ratio,
        v_logrank_p,
        v_ci
    );

    RAISE NOTICE 'Survival analysis complete — trial=% endpoint=% HR=% p=%',
        p_trial_id, p_endpoint_type, v_hazard_ratio, v_logrank_p;
END;
$$;