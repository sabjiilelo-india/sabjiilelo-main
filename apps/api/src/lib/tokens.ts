import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Role } from '@sabjiilelo/shared';
import { env } from '../config/env';
import { prisma } from './prisma';

export interface AccessClaims {
  sub: string;
  role: Role;
  areaId: string | null;
  name: string | null;
}

const ACCESS_TTL = '15m';
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function signAccess(claims: AccessClaims): string {
  return jwt.sign(claims, env.JWT_SECRET, { expiresIn: ACCESS_TTL });
}

export function verifyAccess(token: string): AccessClaims {
  return jwt.verify(token, env.JWT_SECRET) as AccessClaims;
}

export function sha256(value: string): string {
  return crypto.createHmac('sha256', env.REFRESH_SECRET).update(value).digest('hex');
}

export async function createSession(userId: string, client: string) {
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await prisma.session.create({
    data: { userId, client, tokenHash: sha256(refreshToken), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });
  return refreshToken;
}

export async function revokeUserSessions(userId: string) {
  await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
