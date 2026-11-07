import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

export const prisma = new PrismaClient({
  log: [{ emit: 'event', level: 'query' }, 'warn', 'error'],
  transactionOptions: { maxWait: 15_000, timeout: 45_000 },
});

// Set PRISMA_QUERY_LOG=1 to print every database query with its duration (how slow requests are diagnosed).
if (process.env.PRISMA_QUERY_LOG === '1') {
  prisma.$on('query', (e) => {
    logger.info(`db ${String(e.duration).padStart(4)}ms  ${e.query.replace(/\s+/g, ' ').slice(0, 120)}`);
  });
}

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
