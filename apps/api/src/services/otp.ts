import crypto from 'node:crypto';
import { env } from '../config/env';
import { tooMany, badRequest } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { sha256 } from '../lib/tokens';
import { logger } from '../lib/logger';

export interface OtpProvider {
  generate(): string;
  send(phone: string, code: string): Promise<void>;
}

/** No SMS: every phone uses the same configured code (dev / pre-launch). */
const fixedProvider: OtpProvider = {
  generate: () => env.OTP_FIXED,
  async send(phone) {
    logger.info({ phone }, `OTP requested (fixed mode, code ${env.OTP_FIXED})`);
  },
};

/** Placeholder for MSG91 once a DLT template and auth key are available. */
const msg91Provider: OtpProvider = {
  generate: () => String(crypto.randomInt(1000, 10000)),
  async send() {
    throw new Error('MSG91 is not configured yet. Set OTP_MODE=fixed.');
  },
};

const provider = env.OTP_MODE === 'msg91' ? msg91Provider : fixedProvider;

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_15_MIN = 5;

export async function requestOtp(phone: string) {
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const recent = await prisma.otpCode.count({ where: { phone, createdAt: { gte: since } } });
  if (recent >= MAX_REQUESTS_PER_15_MIN) throw tooMany('Too many OTP requests. Try again in a few minutes.');

  const code = provider.generate();
  await prisma.otpCode.create({
    data: { phone, codeHash: sha256(`${phone}:${code}`), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });
  await provider.send(phone, code);
  return { expiresInSec: OTP_TTL_MS / 1000, devHint: env.OTP_MODE === 'fixed' ? env.OTP_FIXED : undefined };
}

export async function verifyOtp(phone: string, code: string) {
  const otp = await prisma.otpCode.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) throw badRequest('OTP expired. Please request a new one.');
  if (otp.attempts >= MAX_ATTEMPTS) throw tooMany('Too many wrong attempts. Request a new OTP.');

  if (otp.codeHash !== sha256(`${phone}:${code}`)) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw badRequest('Incorrect OTP');
  }
  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
}
