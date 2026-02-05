INSERT INTO users (
  username, 
  password_hash, 
  email, 
  role, 
  site_id, 
  is_active
) 
VALUES 
-- THE 6 PRINCIPAL INVESTIGATORS (PIs)
-- Mapped 'Principal Investigator' -> 'Principal_Investigator'

-- Site 1: Mass General
('dr_connor', 'hashed_pass_123', 'sconnor@mgh.harvard.edu', 'Principal_Investigator', 1, true),

-- Site 2: St. Marys London
('dr_watson', 'hashed_pass_123', 'jwatson@stmarys.uk', 'Principal_Investigator', 2, true),

-- Site 3: Charité Germany
('dr_gruber', 'hashed_pass_123', 'hgruber@charite.de', 'Principal_Investigator', 3, true),

-- Site 4: MD Anderson
('dr_grey', 'hashed_pass_123', 'mgrey@mdanderson.org', 'Principal_Investigator', 4, true),

-- Site 5: Tokyo Hospital
('dr_tanaka', 'hashed_pass_123', 'atanaka@u-tokyo.jp', 'Principal_Investigator', 5, true),

-- Site 6: Mayo Clinic
('dr_house', 'hashed_pass_123', 'ghouse@mayo.edu', 'Principal_Investigator', 6, true),


-- THE 10 STUDY NURSES
-- Mapped 'Study Nurse' -> 'Study_Coordinator' (Closest match in your ENUM)

-- Site 1 Nurses (Mass General)
('nurse_joy', 'hashed_pass_123', 'joy@mgh.harvard.edu', 'Study_Coordinator', 1, true),
('nurse_jackie', 'hashed_pass_123', 'jackie@mgh.harvard.edu', 'Study_Coordinator', 1, true),

-- Site 2 Nurses (St. Marys London)
('nurse_florence', 'hashed_pass_123', 'florence@stmarys.uk', 'Study_Coordinator', 2, true),
('nurse_ratched', 'hashed_pass_123', 'mratched@stmarys.uk', 'Study_Coordinator', 2, true),

-- Site 3 Nurse (Charité Germany)
('nurse_carla', 'hashed_pass_123', 'carla@charite.de', 'Study_Coordinator', 3, true),

-- Site 4 Nurses (MD Anderson)
('nurse_peter', 'hashed_pass_123', 'peter@mdanderson.org', 'Study_Coordinator', 4, true),
('nurse_ann', 'hashed_pass_123', 'ann@mdanderson.org', 'Study_Coordinator', 4, true),

-- Site 5 Nurse (Tokyo Hospital)
('nurse_sakura', 'hashed_pass_123', 'sakura@u-tokyo.jp', 'Study_Coordinator', 5, true),

-- Site 6 Nurse (Mayo Clinic)
('nurse_rory', 'hashed_pass_123', 'rory@mayo.edu', 'Study_Coordinator', 6, true),

-- Site 7 Nurse (Toronto General)
('nurse_ben', 'hashed_pass_123', 'ben@toronto-gen.ca', 'Study_Coordinator', 7, true);