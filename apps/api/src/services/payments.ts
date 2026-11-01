import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env';
import { logger } from '../lib/logger';

/**
 * Razorpay gateway. Without keys the API runs a mock gateway so checkout,
 * verification and refunds can be exercised end to end in development.
 */
const client = env.razorpayEnabled
  ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET })
  : null;

export const MOCK_KEY_ID = 'rzp_mock';
const MOCK_SECRET = 'mock-secret';

export const gateway = {
  isMock: !client,
  keyId: client ? env.RAZORPAY_KEY_ID : MOCK_KEY_ID,

  async createOrder(amountPaise: number, receipt: string): Promise<{ id: string }> {
    if (!client) return { id: `order_mock_${crypto.randomBytes(8).toString('hex')}` };
    const o = await client.orders.create({ amount: amountPaise, currency: 'INR', receipt });
    return { id: o.id };
  },

  verifySignature(razorpayOrderId: string, razorpayPaymentId: string, signature: string): boolean {
    const secret = client ? env.RAZORPAY_KEY_SECRET : MOCK_SECRET;
    const expected = crypto.createHmac('sha256', secret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
    return safeEqual(expected, signature);
  },

  /** Lets the mock checkout produce a valid signature. Only usable in mock mode. */
  mockSign(razorpayOrderId: string, razorpayPaymentId: string): string {
    if (client) throw new Error('mockSign is only available without Razorpay keys');
    return crypto.createHmac('sha256', MOCK_SECRET).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
  },

  verifyWebhook(rawBody: Buffer, signature: string | undefined): boolean {
    if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
    const expected = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
    return safeEqual(expected, signature);
  },

  async refund(razorpayPaymentId: string, amountPaise: number, notes: Record<string, string>): Promise<{ id: string }> {
    if (!client || razorpayPaymentId.startsWith('pay_mock_')) {
      return { id: `rfnd_mock_${crypto.randomBytes(6).toString('hex')}` };
    }
    const r = await client.payments.refund(razorpayPaymentId, { amount: amountPaise, notes });
    logger.info({ refundId: r.id, amountPaise }, 'razorpay refund created');
    return { id: r.id };
  },
};

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
