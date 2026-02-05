-- 1. Insert Treatment Arms (So we can randomize patients later)
INSERT INTO treatment_arms (trial_id, arm_code, arm_description, allocation_ratio, blinding_level) VALUES
-- Trial 1 (Vaccine)
(1, 'ARM-A', 'mRNA-1273 Vaccine (Active)', '1:1', 'Double Blind'),
(1, 'ARM-B', 'Placebo (Saline)', '1:1', 'Double Blind'),

-- Trial 2 (Cancer)
(2, 'ARM-K', 'Pembrolizumab 200mg', '1:1', 'Open Label'),
(2, 'ARM-C', 'Standard Chemotherapy', '1:1', 'Open Label'),

-- Trial 3 (Diabetes)
(3, 'ARM-O', 'Semaglutide 1.0mg', '1:1', 'Double Blind'),
(3, 'ARM-P', 'Placebo', '1:1', 'Double Blind');