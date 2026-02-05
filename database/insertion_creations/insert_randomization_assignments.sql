INSERT INTO randomization_assignments (patient_id, arm_id, randomization_method, random_seed) VALUES
-- Trial 1 (Vaccine)
(1, 1, 'Stratified', 'SEED-101'), -- Alice -> Vaccine
(2, 2, 'Stratified', 'SEED-102'), -- Bob -> Placebo (Before he withdrew)
(3, 1, 'Stratified', 'SEED-103'), -- Charlie -> Vaccine
(5, 2, 'Stratified', 'SEED-105'), -- Edward -> Placebo

-- Trial 2 (Cancer)
(9, 3, 'Simple', 'SEED-209'),     -- Ian -> Keytruda
(10, 3, 'Simple', 'SEED-210'),    -- Jessica -> Keytruda

-- Trial 3 (Diabetes)
(13, 5, 'Block', 'SEED-313'),     -- Michael -> Semaglutide
(14, 6, 'Block', 'SEED-314'),     -- Nancy -> Placebo
(15, 5, 'Block', 'SEED-315');     -- Oscar -> Semaglutide