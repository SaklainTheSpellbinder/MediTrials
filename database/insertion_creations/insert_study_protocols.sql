INSERT INTO study_protocols (
    trial_id, 
    version_number, 
    protocol_document, 
    approval_date, 
    approved_by_user_id, 
    electronic_signature, 
    amendment_number, 
    valid_from, 
    valid_to
) VALUES 
-- Data for Trial ID 1 
(
    1, 
    'v1.0', 
    '{"title": "Initial Protocol", "objectives": ["Evaluate Safety", "Determine Efficacy"], "target_enrollment": 500}'::jsonb, 
    '2024-02-01', 
    17,  -- Changed to dr_connor's user_id
    'e-sig_1a2b3c4d5e', 
    0, 
    '2024-02-01', 
    NULL
),

-- Data for Trial ID 2 
(
    2, 
    'v2.1', 
    '{"title": "Amended Protocol", "dose_escalation": true, "primary_endpoint": "Progression-Free Survival"}'::jsonb, 
    '2023-10-15', 
    22,  -- Changed to dr_house's user_id
    'e-sig_9f8e7d6c5b', 
    1, 
    '2023-10-20', 
    NULL
),

-- Data for Trial ID 3
(
    3, 
    'v1.0', 
    '{"title": "Phase IV Observation", "study_type": "Observational", "endpoints": ["Long-term cardiovascular outcomes"]}'::jsonb, 
    '2021-12-10', 
    33,  -- Changed to pi_site_1's user_id
    'e-sig_z1y2x3w4v5', 
    0, 
    '2022-01-01', 
    '2024-01-20'
);