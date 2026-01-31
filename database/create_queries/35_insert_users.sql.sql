INSERT INTO users (
  full_name,
  username, 
  password, 
  email, 
  role, 
  site_id, 
  is_active
) 
VALUES 
-- THE 6 PRINCIPAL INVESTIGATORS (PIs)
-- (One for each of the first 6 sites)

-- Site 1: Mass General (Vaccine Trial)
('Dr. Sarah Connor', 'dr_connor', 'hashed_pass_123', 'sconnor@mgh.harvard.edu', 'Principal Investigator', 1, true),

-- Site 2: St. Marys London (Vaccine Trial)
('Dr. John Watson', 'dr_watson', 'hashed_pass_123', 'jwatson@stmarys.uk', 'Principal Investigator', 2, true),

-- Site 3: Charité Germany (Vaccine Trial)
('Dr. Hans Gruber', 'dr_gruber', 'hashed_pass_123', 'hgruber@charite.de', 'Principal Investigator', 3, true),

-- Site 4: MD Anderson (Cancer Drug)
('Dr. Meredith Grey', 'dr_grey', 'hashed_pass_123', 'mgrey@mdanderson.org', 'Principal Investigator', 4, true),

-- Site 5: Tokyo Hospital (Cancer Drug)
('Dr. Akira Tanaka', 'dr_tanaka', 'hashed_pass_123', 'atanaka@u-tokyo.jp', 'Principal Investigator', 5, true),

-- Site 6: Mayo Clinic (Diabetes Drug)
('Dr. Gregory House', 'dr_house', 'hashed_pass_123', 'ghouse@mayo.edu', 'Principal Investigator', 6, true),


-- THE 10 STUDY NURSES

-- Site 1 Nurses (Mass General)
('Nurse Joy', 'nurse_joy', 'hashed_pass_123', 'joy@mgh.harvard.edu', 'Study Nurse', 1, true),
('Nurse Jackie', 'nurse_jackie', 'hashed_pass_123', 'jackie@mgh.harvard.edu', 'Study Nurse', 1, true),

-- Site 2 Nurses (St. Marys London)
('Nurse Florence', 'nurse_florence', 'hashed_pass_123', 'florence@stmarys.uk', 'Study Nurse', 2, true),
('Nurse Ratched', 'nurse_ratched', 'hashed_pass_123', 'mratched@stmarys.uk', 'Study Nurse', 2, true),

-- Site 3 Nurse (Charité Germany)
('Nurse Carla', 'nurse_carla', 'hashed_pass_123', 'carla@charite.de', 'Study Nurse', 3, true),

-- Site 4 Nurses (MD Anderson)
('Nurse Peter', 'nurse_peter', 'hashed_pass_123', 'peter@mdanderson.org', 'Study Nurse', 4, true),
('Nurse Ann', 'nurse_ann', 'hashed_pass_123', 'ann@mdanderson.org', 'Study Nurse', 4, true),

-- Site 5 Nurse (Tokyo Hospital)
('Nurse Sakura', 'nurse_sakura', 'hashed_pass_123', 'sakura@u-tokyo.jp', 'Study Nurse', 5, true),

-- Site 6 Nurse (Mayo Clinic)
('Nurse Rory', 'nurse_rory', 'hashed_pass_123', 'rory@mayo.edu', 'Study Nurse', 6, true),

-- Site 7 Nurse (Toronto General)
('Nurse Ben', 'nurse_ben', 'hashed_pass_123', 'ben@toronto-gen.ca', 'Study Nurse', 7, true);