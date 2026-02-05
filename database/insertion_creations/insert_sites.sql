INSERT INTO study_sites (
  trial_id,
  institution_name,
  country,
  site_status,
  target_enrollment,
  current_enrollment,
  site_initiation_date,
  updated_at
)
VALUES
-- SITES FOR TRIAL 1: mRNA Vaccine
(
  1, -- "mRNA Vaccine Trial"
  'Massachusetts General Hospital',
  'USA',
  'Active',  -- Schema constraint: mapped from 'Recruiting'
  1000, 
  450,
  '2024-04-01',
  CURRENT_TIMESTAMP
),
(
  1, -- "mRNA Vaccine Trial"
  'St. Marys Hospital London',
  'UK',
  'Active',  -- Schema constraint: mapped from 'Recruiting'
  800,
  320,
  '2024-04-15',
  CURRENT_TIMESTAMP
),
(
  1, -- "mRNA Vaccine Trial"
  'Charité University Hospital',
  'Germany',
  'Active',  -- Schema constraint: mapped from 'Recruiting'
  800,
  110,
  '2024-05-01',
  CURRENT_TIMESTAMP
),

-- SITES FOR TRIAL 2: Cancer Drug
(
  2, -- "Keytruda Cancer Trial"
  'MD Anderson Cancer Center',
  'USA',
  'Active', -- Schema constraint: mapped from 'Active, Not Recruiting'
  100,
  100, 
  '2023-11-15',
  CURRENT_TIMESTAMP
),
(
  2, -- "Keytruda Cancer Trial"
  'Tokyo University Hospital',
  'Japan',
  'Active', -- Schema constraint: mapped from 'Active, Not Recruiting'
  100,
  98,
  '2023-12-01',
  CURRENT_TIMESTAMP
),

-- SITES FOR TRIAL 3: Diabetes Drug
(
  3, -- "Ozempic Diabetes Trial"
  'Mayo Clinic Rochester',
  'USA',
  'Closed', -- Schema constraint: mapped from 'Completed'
  750,
  750,
  '2022-02-01',
  CURRENT_TIMESTAMP
),
(
  3, -- "Ozempic Diabetes Trial"
  'Toronto General Hospital',
  'Canada',
  'Closed', -- Schema constraint: mapped from 'Completed'
  750,
  745,
  '2022-02-10',
  CURRENT_TIMESTAMP
);