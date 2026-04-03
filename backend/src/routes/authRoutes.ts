import { Router } from 'express';
import { pool } from '../config/db';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { JWT_CONFIG, COOKIE_CONFIG } from '../config/jwt.config';
import { authMiddleware } from '../middleware/authMiddleware';
import type { SignOptions } from 'jsonwebtoken';
const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password, role } = req.body;

  try {
    //first finding out if any user with that username and role
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
    
    // 4. GENERATE JWT TOKEN
    const token = jwt.sign(
      {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        site_id: user.site_id,
      },
      JWT_CONFIG.secret,
      { expiresIn: JWT_CONFIG.expiresIn as SignOptions['expiresIn']}
    );

    // 5. SET HTTPONLY COOKIE
    res.cookie('token', token, COOKIE_CONFIG);

    // 6. REMOVE PASSWORD BEFORE SENDING
    const { password_hash: _, ...userSafe } = user;

    res.json({
      success: true,
      user: userSafe,
    });

  } catch (err: any) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: 'Invalid Credentials' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  // Clear the httpOnly cookie
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/me - Session recovery endpoint
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    // authMiddleware has already validated and decoded the token into req.user
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Fetch full user data from database
    const result = await pool.query(
      'SELECT user_id, username, role, email, site_id FROM public.users WHERE user_id = $1',
      [req.user.user_id]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (err: any) {
    console.error('Session recovery error:', err);
    res.status(500).json({ success: false, message: 'Session recovery failed' });
  }
});

export default router;