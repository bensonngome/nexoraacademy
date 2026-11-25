import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const SESSION_SECRET = process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
  ? process.env.SESSION_SECRET.trim()
  : crypto.randomBytes(32).toString('hex');

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@nexora.com').trim().toLowerCase();

export interface SessionPayload {
  userId: number;
  email: string;
  role: 'admin' | 'student';
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  authUser?: {
    id: number;
    email: string;
    full_name: string;
    phone: string;
    role: 'admin' | 'student';
  };
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const keyBuf = Buffer.from(keyHex, 'hex');
    if (derived.length !== keyBuf.length) return false;
    return crypto.timingSafeEqual(derived, keyBuf);
  } catch {
    return false;
  }
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  try {
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
    const sigBuf = Buffer.from(sig, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!decoded || typeof decoded.userId !== 'number' || typeof decoded.exp !== 'number') {
      return null;
    }
    if (Date.now() > decoded.exp) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function requireAuthMiddleware(
  loadUserById: (id: number) => {
    id: number;
    email: string;
    full_name: string;
    phone: string;
    role: 'admin' | 'student';
  } | null
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    const payload = verifySessionToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    }
    const user = loadUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'Account not found.' });
    }
    req.authUser = user;
    next();
  };
}

export function requireAdminMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.authUser.role !== 'admin' || req.authUser.email.toLowerCase() !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Administrator access required.' });
  }
  next();
}
