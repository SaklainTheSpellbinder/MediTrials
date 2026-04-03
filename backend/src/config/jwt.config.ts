import dotenv from 'dotenv';
import type { SignOptions } from 'jsonwebtoken';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn(
    'WARNING: JWT_SECRET is not defined in .env file. Using a temporary insecure secret for development.'
  );
}

export const JWT_CONFIG = {
  secret: (JWT_SECRET || 'dev-secret-key-change-in-production') as string,
  expiresIn: '24h',
  algorithm: 'HS256' as const,
};

export const COOKIE_CONFIG = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
};
