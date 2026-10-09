import type { Request, Response, NextFunction } from 'express';
import { adminDb, type AdminSession } from './admin_db';

export interface AuthenticatedAdminRequest extends Request {
  adminSession?: AdminSession;
}

export function requireAdminAuth(
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer adm_')) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    adminDb.recordAuditLog(
      'UNAUTHORIZED_ACCESS_ATTEMPT',
      'WARN',
      'UNKNOWN_ACTOR',
      ip,
      `Attempted access to protected admin endpoint ${req.method} ${req.path} without admin bearer credentials.`
    );
    return res.status(401).json({
      error: 'Administrator credentials required. Access denied.',
    });
  }

  const token = authHeader.substring(7).trim();
  const session = adminDb.getAdminSession(token);

  if (!session) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    adminDb.recordAuditLog(
      'UNAUTHORIZED_ACCESS_ATTEMPT',
      'WARN',
      'EXPIRED_OR_INVALID_TOKEN',
      ip,
      `Invalid or expired admin session token on ${req.method} ${req.path}.`
    );
    return res.status(401).json({
      error: 'Admin session is invalid or has expired due to inactivity (15 min limit). Please log in again.',
    });
  }

  req.adminSession = session;
  next();
}

// Enforces recent re-authentication (within 5 minutes) for sensitive admin operations
export function requireAdminReauth(
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
) {
  const session = req.adminSession;
  if (!session) {
    return res.status(401).json({ error: 'Admin session required.' });
  }

  if (!adminDb.isReauthenticated(session)) {
    return res.status(403).json({
      error: 'Recent reauthentication required. Please re-enter your administrator credentials to proceed.',
      requiresReauth: true,
    });
  }

  next();
}
