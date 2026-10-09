import type { Request, Response, NextFunction } from 'express';
import { db, type User } from './db';

export interface AuthenticatedRequest extends Request {
  user?: User;
  token?: string;
}

// Simple in-memory rate limiter for login / registration brute force protection
const rateLimitMap = new Map<string, { count: number; firstAttempt: number }>();

// Prevent unbounded memory growth: prune expired windows periodically.
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap) {
    // Keep entries for at most 10 minutes past their window start.
    if (now - record.firstAttempt > 10 * 60 * 1000) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref?.();

export function rateLimiter(maxRequests = 20, windowMs = 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    // When behind a proxy, express `req.ip` respects `trust proxy`. Do not
    // trust client-supplied X-Forwarded-For directly to avoid spoof bypass.
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const routeKey = `${ip}:${req.method}:${req.path}`;
    const now = Date.now();
    const record = rateLimitMap.get(routeKey);

    if (!record) {
      rateLimitMap.set(routeKey, { count: 1, firstAttempt: now });
      return next();
    }

    if (now - record.firstAttempt > windowMs) {
      rateLimitMap.set(routeKey, { count: 1, firstAttempt: now });
      return next();
    }

    record.count++;
    if (record.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment before trying again.',
      });
    }

    next();
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. No session token provided.' });
  }

  const token = authHeader.substring(7).trim();
  const session = db.getSession(token);

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  const user = db.findUserById(session.user_id);
  if (!user) {
    return res.status(401).json({ error: 'User no longer exists.' });
  }

  req.user = user;
  req.token = token;
  next();
}
