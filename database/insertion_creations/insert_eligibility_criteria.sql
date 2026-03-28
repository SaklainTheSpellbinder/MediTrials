-- Eligibility criteria for Trial 1 (mRNA Vaccine Trial)
-- criterion_logic is used by the frontend to auto-evaluate against screening form data

SET search_path TO meditrials;

INSERT INTO eligibility_criteria (trial_id, criterion_type, criterion_text, is_mandatory, criterion_logic)
VALUES
  -- Inclusion criteria (patient MUST meet these)
  (1, 'Inclusion', 'Patient is between 18 and 75 years of age', TRUE, 'age_18_75'),
  (1, 'Inclusion', 'Systolic blood pressure is between 90 and 180 mmHg', TRUE, 'systolic_90_180'),
  (1, 'Inclusion', 'Diastolic blood pressure is between 60 and 110 mmHg', TRUE, 'diastolic_60_110'),
  (1, 'Inclusion', 'Resting heart rate is between 50 and 110 bpm', TRUE, 'hr_50_110'),
  (1, 'Inclusion', 'Body temperature is between 35.5°C and 37.5°C', FALSE, 'temp_normal'),

  -- Exclusion criteria (patient must NOT have these)
  (1, 'Exclusion', 'Patient is currently pregnant or planning pregnancy', TRUE, 'not_pregnant'),
  (1, 'Exclusion', 'Patient has uncontrolled diabetes (HbA1c > 9%)', TRUE, 'no_uncontrolled_diabetes'),
  (1, 'Exclusion', 'Patient has active malignancy (cancer under treatment)', TRUE, 'no_active_cancer'),
  (1, 'Exclusion', 'Patient has severe allergic reaction history (anaphylaxis)', FALSE, 'no_severe_allergy'),
  (1, 'Exclusion', 'Patient participated in another trial within the last 30 days', TRUE, 'no_recent_trial');
