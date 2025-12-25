import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
const { Pool } = require('pg');
import dashboardRoutes from './routes/dashboardRoutes';

dotenv.config();

const app = express();
app.use(express.json());
// Allow your React dev server
app.use(cors({
  origin: 'http://localhost:5173', // Your Vite port
  credentials: true
}));
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'meditrials',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});
app.use('/api/dashboard', dashboardRoutes);
// ========== ROUTES ==========

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'MediTrials Clinical Trials Management API',
    version: '1.0.0',
    status: 'operational',
    endpoints: [
      { method: 'GET', path: '/api/test', description: 'Test database connection' },
      { method: 'GET', path: '/api/patients', description: 'Get all patients' },
      { method: 'GET', path: '/api/patients/:id', description: 'Get single patient' },
      { method: 'GET', path: '/api/visits', description: 'Get all visits' },
      { method: 'GET', path: '/api/labs', description: 'Get all lab results' }
    ]
  });
});

// Test database connection
app.get('/api/test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      success: true,
      message: 'Database connected successfully!', 
      timestamp: result.rows[0].now,
      database: process.env.DB_NAME
    });
  } catch (err: any) {
    res.status(500).json({ 
      success: false,
      error: 'Database connection failed',
      details: err.message 
    });
  }
});

// GET all patients
app.get('/api/patients', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, s.institution_name 
      FROM patients p
      LEFT JOIN study_sites s ON p.site_id = s.site_id
      ORDER BY p.patient_id
      LIMIT 20
    `);
    res.json({
      success: true,
      count: result.rows.length,
      patients: result.rows
    });
  } catch (err: any) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// GET single patient
app.get('/api/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT p.*, s.institution_name 
       FROM patients p
       LEFT JOIN study_sites s ON p.site_id = s.site_id
       WHERE p.patient_id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }
    
    res.json({
      success: true,
      patient: result.rows[0]
    });
  } catch (err: any) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// GET all visits
app.get('/api/visits', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pv.*, p.trial_patient_id, vs.visit_name
      FROM patient_visits pv
      JOIN patients p ON pv.patient_id = p.patient_id
      JOIN visit_schedules vs ON pv.visit_id = vs.visit_id
      ORDER BY pv.scheduled_date DESC
      LIMIT 20
    `);
    res.json({
      success: true,
      count: result.rows.length,
      visits: result.rows
    });
  } catch (err: any) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// GET all lab results
app.get('/api/labs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT lr.*, p.trial_patient_id, lt.test_name, lt.unit_of_measure
      FROM lab_results lr
      JOIN patients p ON lr.patient_id = p.patient_id
      JOIN laboratory_tests lt ON lr.test_id = lt.test_id
      ORDER BY lr.result_date DESC
      LIMIT 20
    `);
    res.json({
      success: true,
      count: result.rows.length,
      labResults: result.rows
    });
  } catch (err: any) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// POST - Create new patient
app.post('/api/patients', async (req, res) => {
  try {
    const {
      trial_patient_id,
      site_id,
      screening_number,
      date_of_birth,
      gender,
      enrollment_date,
      patient_status,
      medical_history_summary
    } = req.body;

    const result = await pool.query(
      `INSERT INTO patients (
        trial_patient_id, site_id, screening_number, date_of_birth,
        gender, enrollment_date, patient_status, medical_history_summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        trial_patient_id, site_id, screening_number, date_of_birth,
        gender, enrollment_date, patient_status, medical_history_summary
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Patient created successfully',
      patient: result.rows[0]
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// PUT - Update patient
app.put('/api/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Build dynamic update query
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(updates)];
    
    const result = await pool.query(
      `UPDATE patients SET ${setClause} WHERE patient_id = $1 RETURNING *`,
      values
    );

    res.json({
      success: true,
      message: 'Patient updated successfully',
      patient: result.rows[0]
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// DELETE - Remove patient
app.delete('/api/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM patients WHERE patient_id = $1', [id]);
    
    res.json({
      success: true,
      message: 'Patient deleted successfully'
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

//import bcrypt from 'bcryptjs'; // Add this import

// Install bcryptjs: cd backend && npm install bcryptjs @types/bcryptjs

// POST - Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    // Validate input
    if (!username || !password || !role) {
      return res.status(400).json({
        success: false,
        error: 'Username, password, and role are required'
      });
    }

    // Find user in database
    const userResult = await pool.query(
      `SELECT * FROM users 
       WHERE username = $1 
       AND role = $2 
       AND is_active = true`,
      [username, role]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username, password, or role'
      });
    }

    const user = userResult.rows[0];

    // In production, use bcrypt to compare hashed passwords
    // For now, compare plain text (since your seed uses plain text)
    if (user.password_hash !== password) {
      // If you used bcrypt in your seed:
      // const isValid = await bcrypt.compare(password, user.password_hash);
      // if (!isValid) { ... }
      
      return res.status(401).json({
        success: false,
        error: 'Invalid username, password, or role'
      });
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE user_id = $1',
      [user.user_id]
    );

    // Return user info (excluding password)
    const { password_hash, password_reset_token, ...userWithoutPassword } = user;

    res.json({
  success: true,
  message: 'Login successful',
  user: userWithoutPassword,
  token: `mock-token-${user.user_id}` // 👈 Include user ID
});

  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});
app.post('/api/auth/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// GET - Check if user is authenticated
// GET - Check if user is authenticated
app.get('/api/auth/me', async (req, res) => {
  try {
    // Get token from Authorization header
    const token = req.headers.authorization?.split(' ')[1];

    // For development: Check localStorage token sent from frontend
    if (!token || token === 'mock-jwt-token') {
      // In production, verify JWT token
      // For now, read user_id from a custom header or session
      const userId = req.headers['x-user-id']; // Frontend should send this
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
      }
      
      // Fetch actual user from database
      const userResult = await pool.query(
        'SELECT user_id, username, role, email, site_id FROM users WHERE user_id = $1 AND is_active = true',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }
      
      return res.json({
        success: true,
        user: userResult.rows[0]
      });
    }
    
    // In production, you'd verify JWT token here
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Then fetch user from database
    
    // For now, return error if token exists but isn't mock
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
    
  } catch (err: any) {
    console.error('Auth me error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});


// ========== START SERVER ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Connected to database: ${process.env.DB_NAME || 'meditrials'}`);
  console.log(`🔗 Test endpoints:`);
  console.log(`   http://localhost:${PORT}/`);
  console.log(`   http://localhost:${PORT}/api/test`);
  console.log(`   http://localhost:${PORT}/api/patients`);
});