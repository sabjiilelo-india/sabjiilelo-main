import crypto from 'node:crypto';
import express, { Router } from 'express';
import { verifyPaymentSchema } from '@sabjiilelo/shared';
import { prisma } from '../lib/prisma';
import { body } from '../lib/http';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { logger } from '../lib/logger';
import { authenticate, me, requireRole } from '../middleware/auth';
import { gateway } from '../services/payments';
import { markPaid, toOrderDetail } from '../services/orders';

export const paymentsRouter = Router();

paymentsRouter.post('/verify', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  const u = me(req);
  const input = body(req, verifyPaymentSchema);
  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: input.razorpayOrderId }, include: { order: true } });
  if (!payment || payment.orderId !== input.orderId) throw notFound('Payment');
  if (payment.order.customerId !== u.sub) throw forbidden();
  if (!gateway.verifySignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature)) {
    throw badRequest('Payment verification failed. If money was debited it will be refunded automatically.');
  }
  const order = await markPaid(input.razorpayOrderId, input.razorpayPaymentId, { via: 'client-verify' });
  res.json(toOrderDetail(order, { id: u.sub, role: u.role }));
});

/** Development checkout: returns what Razorpay Checkout would hand back after a successful payment. */
paymentsRouter.post('/mock-checkout', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  if (!gateway.isMock) throw forbidden('Mock checkout is disabled when Razorpay keys are configured');
  const razorpayOrderId = String(req.body?.razorpayOrderId ?? '');
  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId }, include: { order: true } });
  if (!payment || payment.order.customerId !== me(req).sub) throw notFound('Payment');
  const razorpayPaymentId = `pay_mock_${crypto.randomBytes(8).toString('hex')}`;
  res.json({ razorpayOrderId, razorpayPaymentId, razorpaySignature: gateway.mockSign(razorpayOrderId, razorpayPaymentId) });
});

/** Razorpay server-to-server webhook. Mounted before the JSON parser so the raw body can be verified. */
export const razorpayWebhook = [
  express.raw({ type: 'application/json' }),
  async (req: express.Request, res: express.Response) => {
    const raw = req.body as Buffer;
    if (!gateway.verifyWebhook(raw, req.header('x-razorpay-signature'))) return res.status(400).json({ ok: false });
    const event = JSON.parse(raw.toString('utf8'));
    try {
      if (event.event === 'payment.captured' || event.event === 'order.paid') {
        const p = event.payload?.payment?.entity;
        if (p?.order_id && p?.id) await markPaid(p.order_id, p.id, event);
      }
    } catch (err) {
      logger.error({ err }, 'webhook handling failed');
    }
    res.json({ ok: true });
  },
] as const;
