drop schema public cascade;

CREATE SCHEMA public;


GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;


SELECT 'ALTER TABLE meditrials.' || tablename || ' SET SCHEMA public;'
FROM pg_tables
WHERE schemaname = 'meditrials';


-- Select all rows from 'TableName'
SELECT * FROM public.patients;




DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Move all tables
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'meditrials' LOOP
        EXECUTE 'ALTER TABLE meditrials.' || quote_ident(r.tablename) || ' SET SCHEMA public';
    END LOOP;

    -- 2. Move all sequences
    FOR r IN SELECT sequence_name FROM information_schema.sequences 
             WHERE sequence_schema = 'meditrials' LOOP
        EXECUTE 'ALTER SEQUENCE meditrials.' || quote_ident(r.sequence_name) || ' SET SCHEMA public';
    END LOOP;

    -- 3. Move all functions and procedures
    FOR r IN
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
               CASE WHEN p.prokind = 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END AS objtype
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'meditrials'
    LOOP
        EXECUTE 'ALTER ' || r.objtype || ' meditrials.' 
                || quote_ident(r.proname) || '(' || r.args || ') SET SCHEMA public';
    END LOOP;

    -- 4. Move standard views
    FOR r IN SELECT viewname FROM pg_views WHERE schemaname = 'meditrials' LOOP
        EXECUTE 'ALTER VIEW meditrials.' || quote_ident(r.viewname) || ' SET SCHEMA public';
    END LOOP;

    -- 5. Move materialized views
    FOR r IN SELECT matviewname FROM pg_matviews WHERE schemaname = 'meditrials' LOOP
        EXECUTE 'ALTER MATERIALIZED VIEW meditrials.' || quote_ident(r.matviewname) || ' SET SCHEMA public';
    END LOOP;

END;
$$;



-- Fix generate_screening_number (was referencing meditrials.patients_patient_id_seq)
CREATE OR REPLACE FUNCTION public.generate_screening_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.screening_number IS NULL THEN
        NEW.screening_number := 'SCR-' || to_char(NOW(), 'YYYYMMDD') ||
                                 '-' || LPAD(
                                     (nextval('patients_patient_id_seq'))::TEXT,
                                     6, '0'
                                 );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix reset_sequences (was querying sequence_schema = 'meditrials')
CREATE OR REPLACE FUNCTION public.reset_sequences()
RETURNS VOID AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public'
    LOOP
        EXECUTE 'ALTER SEQUENCE public.' || r.sequence_name || ' RESTART WITH 1';
    END LOOP;
END;
$$ LANGUAGE plpgsql;







-- Should show all your tables in public
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Should show all your functions/procedures
SELECT proname, prokind FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' ORDER BY proname;

-- Should show all materialized views
SELECT matviewname FROM pg_matviews WHERE schemaname = 'public';



select * from public.users;


DELETE FROM public.users 
WHERE username IN (
    'pi_site_1', 
    'coord_site_1', 
    'safety_1', 
    'datamgr_1', 
    'stat_1', 
    'admin'
);


INSERT INTO public.users 
    (username, email, password_hash, role, site_id, is_active)
VALUES 
    -- Site-Specific Roles (Must have a site_id)
    ('pi_site_1', 'pi1@meditrials.com', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'Principal_Investigator', 1, true),
    ('coord_site_1', 'coord1@meditrials.com', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'Study_Coordinator', 1, true),

    -- Global Roles (Must have a NULL site_id)
    ('safety_1', 'safety1@meditrials.com', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'Safety_Monitor', NULL, true),
    ('datamgr_1', 'datamgr1@meditrials.com', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'Data_Manager', NULL, true),
    ('stat_1', 'stat1@meditrials.com', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'Statistician', NULL, true),
    ('admin', 'admin@meditrials.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'System_Admin', NULL, true);

commit;




SELECT
    trigger_name,
    event_object_table AS table_name,
    event_manipulation AS trigger_event,
    action_timing AS timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;





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

SET search_path TO public;

DROP MATERIALIZED VIEW IF EXISTS public.mv_pi_dashboard_stats;


CREATE MATERIALIZED VIEW public.mv_pi_dashboard_stats AS
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





ALTER TABLE public.adverse_events 
  ADD COLUMN outcome VARCHAR(50) CHECK (outcome IN ('Recovered', 'Recovering', 'Not Recovered', 'Fatal', 'Unknown'));