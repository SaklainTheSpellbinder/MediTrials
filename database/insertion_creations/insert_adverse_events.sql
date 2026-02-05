INSERT INTO adverse_events (
  patient_id, visit_instance_id, ae_term, ae_start_date, ae_end_date, 
  severity_grade, causality_relationship, treatment_related, 
  results_in_death, life_threatening, requires_hospitalization
) VALUES
-- 1. Mild Headache (Alice - Vaccine Trial)
(1, 2, 'Mild Headache', '2024-04-06', '2024-04-07', 
 1, 'Possible', TRUE, 
 FALSE, FALSE, FALSE),

-- 2. SERIOUS EVENT (Jessica - Cancer Trial)
-- She had low WBC (from lab results above) -> developed sepsis.
(10, 6, 'Febrile Neutropenia (Sepsis)', '2023-11-22', '2023-11-30', 
 4, 'Probable', TRUE, 
 FALSE, TRUE, TRUE); -- Hospitalized + Life Threatening