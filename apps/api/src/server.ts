import { env } from './config/env';
import { createApp } from './app';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { startJobs } from './jobs/cron';
import { gateway } from './services/payments';

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info(`Sabjii Le Lo API on :${env.PORT} (otp=${env.OTP_MODE}, payments=${gateway.isMock ? 'mock' : 'razorpay'})`);
  startJobs();
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
