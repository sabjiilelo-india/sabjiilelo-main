import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  APP_ROLES,
  adminLoginSchema,
  deleteAccountSchema,
  otpRequestSchema,
  otpVerifySchema,
  pushTokenSchema,
  refreshSchema,
  updateMeSchema,
  type AuthResponse,
} from '@sabjiilelo/shared';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { body } from '../lib/http';
import { AppError, forbidden, unauthorized } from '../lib/errors';
import { createSession, REFRESH_TTL_MS, sha256, signAccess } from '../lib/tokens';
import { toAuthUser, userWithArea } from '../lib/serializers';
import { requestOtp, verifyOtp } from '../services/otp';
import { authenticate, me } from '../middleware/auth';

export const authRouter = Router();

const REFRESH_COOKIE = 'sl_rt';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    maxAge: REFRESH_TTL_MS,
    path: '/api/auth',
  });
}

async function issueTokens(userId: string, client: string, res: Response): Promise<AuthResponse> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
    include: userWithArea,
  });
  const refreshToken = await createSession(user.id, client);
  if (client === 'web') setRefreshCookie(res, refreshToken);
  return {
    accessToken: signAccess({ sub: user.id, role: user.role, areaId: user.areaId, name: user.name }),
    refreshToken,
    user: toAuthUser(user),
  };
}

authRouter.post('/otp/request', async (req, res) => {
  const { phone } = body(req, otpRequestSchema);
  res.json(await requestOtp(phone));
});

authRouter.post('/otp/verify', async (req, res) => {
  const { phone, code, client } = body(req, otpVerifySchema);
  await verifyOtp(phone, code);

  // Unknown numbers become customers. Staff numbers exist already because an admin created them.
  const user = await prisma.user.upsert({ where: { phone }, update: {}, create: { phone, role: 'CUSTOMER' } });

  if (user.status === 'BLOCKED') throw forbidden('This account is blocked. Contact support.');
  if (user.role === 'SUPERADMIN') throw forbidden('Super admin signs in at /admin');
  if (client === 'app' && !APP_ROLES.includes(user.role)) {
    throw new AppError(403, 'USE_WEB_PORTAL', 'Your role uses the Sabjii Le Lo web portal. Please sign in on the web.');
  }
  res.json(await issueTokens(user.id, client, res));
});

authRouter.post('/admin/login', async (req, res) => {
  const { username, password } = body(req, adminLoginSchema);
  const cred = await prisma.superAdminCredential.findUnique({ where: { username }, include: { user: true } });
  const ok = cred && (await bcrypt.compare(password, cred.passwordHash));
  if (!ok) throw unauthorized('Wrong username or password');
  if (cred.user.status === 'BLOCKED') throw forbidden('This account is blocked');
  res.json(await issueTokens(cred.userId, 'web', res));
});

authRouter.post('/refresh', async (req, res) => {
  const { refreshToken: fromBody } = body(req, refreshSchema);
  const token = fromBody ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined);
  if (!token) throw unauthorized();

  const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) throw unauthorized('Session expired');
  if (session.user.status === 'BLOCKED') throw forbidden('This account is blocked');

  // Rotate: the old refresh token can never be used again.
  await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  res.json(await issueTokens(session.userId, session.client, res));
});

authRouter.post('/logout', async (req, res) => {
  const token = (req.body?.refreshToken as string | undefined) ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined);
  if (token) {
    await prisma.session.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.json({ ok: true });
});

authRouter.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: me(req).sub }, include: userWithArea });
  if (!user || user.status === 'BLOCKED') throw unauthorized();
  res.json(toAuthUser(user));
});

authRouter.patch('/me', authenticate, async (req, res) => {
  const data = body(req, updateMeSchema);
  const user = await prisma.user.update({ where: { id: me(req).sub }, data, include: userWithArea });
  res.json(toAuthUser(user));
});

/**
 * Self-service account deletion (customers only; staff are removed by their admin).
 * Personal data is erased and the phone number is freed; orders stay for invoices and tax records.
 */
authRouter.delete('/me', authenticate, async (req, res) => {
  body(req, deleteAccountSchema);
  const u = me(req);
  if (u.role !== 'CUSTOMER') throw forbidden('Staff accounts are removed by your area admin');
  const active = await prisma.order.count({
    where: { customerId: u.sub, status: { in: ['PAYMENT_PENDING', 'PLACED', 'CONFIRMED', 'PACKING', 'PACKED', 'ASSIGNED', 'OUT_FOR_DELIVERY'] } },
  });
  if (active) throw new AppError(409, 'ACTIVE_ORDERS', 'You have orders in progress. Please wait until they are delivered or cancel them first.');

  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { userId: u.sub } }),
    prisma.address.updateMany({ where: { userId: u.sub }, data: { isDeleted: true, isDefault: false, name: 'Deleted', phone: '', line1: 'Deleted', landmark: null, lat: null, lng: null } }),
    prisma.session.updateMany({ where: { userId: u.sub, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.notification.deleteMany({ where: { userId: u.sub } }),
    prisma.user.update({
      where: { id: u.sub },
      data: { phone: `deleted:${u.sub}`, name: null, email: null, expoPushToken: null, status: 'BLOCKED', deletedAt: new Date() },
    }),
  ]);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.json({ ok: true });
});

authRouter.post('/push-token', authenticate, async (req, res) => {
  const { token } = body(req, pushTokenSchema);
  await prisma.user.update({ where: { id: me(req).sub }, data: { expoPushToken: token } });
  res.json({ ok: true });
});
