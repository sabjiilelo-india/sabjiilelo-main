import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { errorHandler, notFoundHandler } from './middleware/error';
import { BRAND_ASSETS_DIR, UPLOAD_DIR } from './services/storage';
import { authRouter } from './modules/auth.routes';
import { areasRouter } from './modules/areas.routes';
import { staffRouter } from './modules/staff.routes';
import { catalogRouter } from './modules/catalog.routes';
import { manageRouter } from './modules/manage.routes';
import { customerRouter } from './modules/customer.routes';
import { paymentsRouter, razorpayWebhook } from './modules/payments.routes';
import { invoiceRouter, opsRouter } from './modules/ops.routes';
import { riderRouter } from './modules/rider.routes';
import { vendorRouter } from './modules/vendor.routes';
import { supplyRouter } from './modules/supply.routes';
import { accountsRouter } from './modules/accounts.routes';
import { reportsRouter } from './modules/reports.routes';
import { notificationsRouter, uploadsRouter } from './modules/misc.routes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin) || !env.isProd),
      credentials: true,
    }),
  );
  if (!env.isTest) app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  // Must see the raw body to verify Razorpay's signature.
  app.post('/api/payments/webhook', ...razorpayWebhook);

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
  // Brand artwork (logo, banners, 3D icons) from the repo's /public folder, for the mobile app and seeded banners.
  app.use('/static', express.static(BRAND_ASSETS_DIR, { maxAge: '7d' }));

  app.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, time: new Date().toISOString() });
  });

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.isProd ? 30 : 1000, standardHeaders: true, legacyHeaders: false });
  const api = express.Router();
  api.use('/auth', authLimiter, authRouter);
  api.use('/catalog', catalogRouter);
  api.use('/me', customerRouter);
  api.use('/payments', paymentsRouter);
  api.use('/ops', opsRouter);
  api.use('/invoices', invoiceRouter);
  api.use('/manage', manageRouter);
  api.use('/staff', staffRouter);
  api.use('/rider', riderRouter);
  api.use('/vendor', vendorRouter);
  api.use('/supply', supplyRouter);
  api.use('/accounts', accountsRouter);
  api.use('/reports', reportsRouter);
  api.use('/notifications', notificationsRouter);
  api.use('/uploads', uploadsRouter);
  api.use('/', areasRouter);
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
