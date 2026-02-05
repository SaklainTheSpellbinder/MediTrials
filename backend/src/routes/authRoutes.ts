import { Router } from 'express';
import { pool } from '../config/db';
import type { Request, Response } from 'express';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password, role } = req.body;

  try {
    // 1. QUERY THE REAL DATABASE
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND role = $2',
      [username, role]
    );

    const user = result.rows[0];

    // 2. CHECK PASSWORD (Simple check for your current data)
    if (!user || user.password_hash !== password) {
      await pool.query(
        `INSERT INTO user_access_log (user_id, access_type) VALUES ($1, 'LOGIN_FAILED')`,
        [user?.user_id || null]
      );

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or role'
      });
    }

    // 3. SUCCESS: UPDATE LAST LOGIN TIME
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1', [user.user_id]);

    // 4. REMOVE PASSWORD BEFORE SENDING
    const { password_hash: _, ...userSafe } = user;

    res.json({
      success: true,
      user: userSafe,
      token: 'mock-jwt-token-for-now' 
    });

  } catch (err: any) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: 'Invalid Credentials' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  // You can add DB logging here if you want
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;