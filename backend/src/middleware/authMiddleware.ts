import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/jwt.config';


declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: number;
        username: string;
        role: string;
        site_id?: number;
      };
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    //Extract token from httpOnly cookie
    const token = req.cookies?.token;

    if (!token) {
      res.status(401).json({ success: false, message: 'No authentication token provided' });
      return;
    }

    // Verify and decode token
    const decoded = jwt.verify(token, JWT_CONFIG.secret) as {
      user_id: number;
      username: string;
      role: string;
      site_id?: number;
    };


    // Inject user data into request object
    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, message: 'Token expired' });
      return;
    }
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ success: false, message: 'Invalid token' });
      return;
    }
    res.status(500).json({ success: false, message: 'Authentication error' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    next();
  };
};
