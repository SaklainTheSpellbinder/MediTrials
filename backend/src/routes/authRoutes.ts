import { Router } from 'express';
import { pool } from '../config/db';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password, role } = req.body;

  try {
    // 1. QUERY THE REAL DATABASE
    const result = await pool.query(
      'SELECT * FROM public.users WHERE username = $1 AND role = $2',
      [username, role]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials or role' });
    }

    // 2. CHECK PASSWORD
    let isValid = false;

    // Check 1: Exact match (Handles Quick-Fill buttons which send the raw hash)
    if (user.password_hash === password) {
      isValid = true;
    }

    // Check 2: Bcrypt (Handles newly created users via Admin Dashboard)
    if (!isValid && user.password_hash.startsWith('$2b$')) {
      isValid = await bcrypt.compare(password, user.password_hash);
    }

    // Check 3: SHA-256 (Handles original seeded users if user types the plaintext password)
    if (!isValid) {
      const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
      if (user.password_hash === sha256Hash) {
        isValid = true;
      }
    }

    if (!isValid) {
      await pool.query(
        `INSERT INTO public.user_access_log (user_id, access_type, accessed_table) VALUES ($1, 'LOGIN_FAILED', 'users')`,
        [user.user_id]
      );
      return res.status(401).json({ success: false, message: 'Invalid credentials or role' });
    }

    // 3. SUCCESS: UPDATE LAST LOGIN TIME
    await pool.query('UPDATE public.users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1', [user.user_id]);

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