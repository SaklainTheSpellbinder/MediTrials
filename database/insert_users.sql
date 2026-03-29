-- Assuming users table is in the public schema based on the database structure of MediTrials2
-- The password hashes match the hardcoded strings sent by the quick-fill buttons in frontend/src/pages/Login.tsx
-- The SHA-256 hash 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f' corresponds to "password123" for regular users
-- The SHA-256 hash '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9' corresponds to "admin123" for the admin

INSERT INTO public.users (username, email, role, password_hash, site_id, is_active)
VALUES 
    -- 1. Principal Investigator (Requires a valid site_id to see site-specific data)
    ('pi_site_1', 'pi_site_1@meditrials.com', 'Principal_Investigator', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 1, true),
    
    -- 2. Study Coordinator (Requires a valid site_id to see site-specific data)
    ('coord_site_1', 'coord_site_1@meditrials.com', 'Study_Coordinator', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 1, true),
    
    -- 3. Safety Monitor (Global role, no site_id required)
    ('safety_1', 'safety_1@meditrials.com', 'Safety_Monitor', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', NULL, true),
    
    -- 4. Data Manager (Global role, no site_id required)
    ('datamgr_1', 'datamgr_1@meditrials.com', 'Data_Manager', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', NULL, true),
    
    -- 5. Statistician (Global role, no site_id required)
    ('stat_1', 'stat_1@meditrials.com', 'Statistician', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', NULL, true),
    
    -- 6. System Admin (Global role, no site_id required, uses a different password hash)
    ('admin', 'admin@meditrials.com', 'System_Admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', NULL, true)
ON CONFLICT (username) 
DO UPDATE SET 
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    site_id = EXCLUDED.site_id,
    is_active = EXCLUDED.is_active;
