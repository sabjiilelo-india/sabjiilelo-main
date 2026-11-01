import type { NextFunction, Request, Response } from 'express';
import { can, type Permission, type Role } from '@sabjiilelo/shared';
import { forbidden, unauthorized } from '../lib/errors';
import { verifyAccess, type AccessClaims } from '../lib/tokens';
import { q } from '../lib/http';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessClaims;
    }
  }
}

function readToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7);
  return null;
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) return next(unauthorized());
  try {
    req.user = verifyAccess(token);
    next();
  } catch {
    next(unauthorized('Session expired'));
  }
}

/** Attaches req.user when a valid token is present but never rejects. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (token) {
    try {
      req.user = verifyAccess(token);
    } catch {
      /* treat as anonymous */
    }
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!can(req.user.role, permission)) return next(forbidden());
    next();
  };
}

export function me(req: Request): AccessClaims {
  if (!req.user) throw unauthorized();
  return req.user;
}

/**
 * The area every staff query is pinned to. Staff always get their own area;
 * the super admin may look at any area by passing ?areaId= (read-only overview screens).
 */
export function scopeArea(req: Request): string {
  const u = me(req);
  if (u.role === 'SUPERADMIN') {
    const areaId = q(req, 'areaId');
    if (!areaId) throw forbidden('Choose an area');
    return areaId;
  }
  if (!u.areaId) throw forbidden('Your account is not assigned to an area');
  return u.areaId;
}

/** Throws 403 when a record belongs to another area. */
export function assertSameArea(req: Request, recordAreaId: string | null | undefined) {
  const u = me(req);
  if (u.role === 'SUPERADMIN') return;
  if (!recordAreaId || recordAreaId !== u.areaId) throw forbidden('This belongs to another area');
}
