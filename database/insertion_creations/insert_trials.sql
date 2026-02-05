INSERT INTO clinical_trials (
  trial_nct_id, 
  trial_title, 
  trial_phase, 
  therapeutic_area, 
  trial_status, 
  start_date, 
  estimated_completion_date, 
  target_enrollment, 
  updated_at
) 
VALUES 
-- Trial 1: A Vaccine Trial (COVID-19 Prevention)
(
  'NCT04829103', 
  'Safety and Efficacy of mRNA-1273 Vaccine in Preventing COVID-19 in Adults', 
  'Phase III',             -- Corrected from 'Phase 3'
  'Infectious Disease', 
  'Recruiting', 
  '2024-03-15', 
  '2027-12-30', 
  30000, 
  CURRENT_TIMESTAMP
),

-- Trial 2: An Oncology Drug Trial (Cancer Treatment)
(
  'NCT03928174', 
  'Evaluation of Pembrolizumab (Keytruda) for the Treatment of Gastric Cancer', 
  'Phase II',              -- Corrected from 'Phase 2'
  'Oncology', 
  'Active',                -- Corrected from 'Active, Not Recruiting' to match constraints
  '2023-11-01', 
  '2025-06-15', 
  200, 
  CURRENT_TIMESTAMP
),

-- Trial 3: A Metabolic Drug Trial (Diabetes)
(
  'NCT05129482', 
  'Efficacy of Semaglutide (Ozempic) in Patients with Type 2 Diabetes', 
  'Phase IV',              -- Corrected from 'Phase 4'
  'Metabolic Disorders', 
  'Completed', 
  '2022-01-10', 
  '2024-01-20', 
  1500, 
  CURRENT_TIMESTAMP
);