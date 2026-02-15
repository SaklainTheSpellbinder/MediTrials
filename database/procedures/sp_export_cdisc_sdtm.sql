CREATE OR REPLACE PROCEDURE sp_export_cdisc_sdtm(
    p_trial_id INTEGER,
    INOUT dm_data JSONB DEFAULT NULL,
    INOUT ae_data JSONB DEFAULT NULL,
    INOUT vs_data JSONB DEFAULT NULL,
    INOUT lb_data JSONB DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    -- DM Domain (Demographics)
    SELECT jsonb_agg(
        jsonb_build_object(
            'STUDYID', ct.trial_nct_id,
            'DOMAIN', 'DM',
            'USUBJID', p.trial_patient_id,
            'BRTHDTC', to_char(p.date_of_birth, 'YYYY-MM-DD'),
            'SEX', p.gender,
            'RACE', 'UNKNOWN',
            'COUNTRY', ss.country,
            'RFSTDTC', to_char(p.enrollment_date, 'YYYY-MM-DD')
        )
    ) INTO dm_data
    FROM patients p
    JOIN study_sites ss ON p.site_id = ss.site_id
    JOIN clinical_trials ct ON ss.trial_id = ct.trial_id
    WHERE ss.trial_id = p_trial_id;

    -- AE Domain
    SELECT jsonb_agg(
        jsonb_build_object(
            'STUDYID', ct.trial_nct_id,
            'DOMAIN', 'AE',
            'USUBJID', p.trial_patient_id,
            'AESEQ', ae.ae_id,
            'AETERM', ae.ae_term,
            'AESTDTC', to_char(ae.ae_start_date, 'YYYY-MM-DD'),
            'AEENDTC', to_char(ae.ae_end_date, 'YYYY-MM-DD'),
            'AESEV', CASE 
                WHEN ae.severity_grade = 1 THEN 'MILD'
                WHEN ae.severity_grade = 2 THEN 'MODERATE'
                WHEN ae.severity_grade >= 3 THEN 'SEVERE'
                ELSE 'UNKNOWN'
            END,
            'AEREL', ae.causality_relationship
        )
    ) INTO ae_data
    FROM adverse_events ae
    JOIN patients p ON ae.patient_id = p.patient_id
    JOIN study_sites ss ON p.site_id = ss.site_id
    JOIN clinical_trials ct ON ss.trial_id = ct.trial_id
    WHERE ss.trial_id = p_trial_id;

    -- VS Domain (simplified: only systolic BP)
    SELECT jsonb_agg(
        jsonb_build_object(
            'STUDYID', ct.trial_nct_id,
            'DOMAIN', 'VS',
            'USUBJID', p.trial_patient_id,
            'VSSEQ', vs.vital_id,
            'VSTESTCD', 'SYSBP',
            'VSORRES', vs.systolic_bp,
            'VSORRESU', 'mmHg'
        )
    ) INTO vs_data
    FROM vital_signs vs
    JOIN patients p ON vs.patient_id = p.patient_id
    JOIN study_sites ss ON p.site_id = ss.site_id
    JOIN clinical_trials ct ON ss.trial_id = ct.trial_id
    WHERE ss.trial_id = p_trial_id;

    -- LB Domain
    SELECT jsonb_agg(
        jsonb_build_object(
            'STUDYID', ct.trial_nct_id,
            'DOMAIN', 'LB',
            'USUBJID', p.trial_patient_id,
            'LBSEQ', lr.result_id,
            'LBTESTCD', lt.test_code_loinc,
            'LBTEST', lt.test_name,
            'LBORRES', lr.result_value,
            'LBORRESU', lt.unit_of_measure,
            'LBSTRESN', lr.result_value,
            'LBSTRESU', lt.unit_of_measure,
            'LBSTNRLO', lr.reference_low,
            'LBSTNRHI', lr.reference_high
        )
    ) INTO lb_data
    FROM lab_results lr
    JOIN laboratory_tests lt ON lr.test_id = lt.test_id
    JOIN patients p ON lr.patient_id = p.patient_id
    JOIN study_sites ss ON p.site_id = ss.site_id
    JOIN clinical_trials ct ON ss.trial_id = ct.trial_id
    WHERE ss.trial_id = p_trial_id;
END;
$$;