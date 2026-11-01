import cron from 'node-cron';
import { addDays, todayIST, ymdToDate } from '@sabjiilelo/shared';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { expireUnpaidOrders } from '../services/orders';

/**
 * Carries the stock board forward so the shop never opens empty:
 * any of the next two days without stock rows gets a copy of the latest board.
 */
export async function rolloverStock() {
  const today = todayIST();
  const areas = await prisma.area.findMany({ where: { isActive: true }, select: { id: true } });
  let copied = 0;
  for (const { id: areaId } of areas) {
    for (const target of [today, addDays(today, 1), addDays(today, 2)]) {
      const has = await prisma.dailyStock.count({ where: { areaId, date: ymdToDate(target) } });
      if (has) continue;
      const latest = await prisma.dailyStock.findFirst({ where: { areaId, date: { lt: ymdToDate(target) } }, orderBy: { date: 'desc' } });
      if (!latest) continue;
      const rows = await prisma.dailyStock.findMany({ where: { areaId, date: latest.date } });
      const r = await prisma.dailyStock.createMany({
        data: rows.map((x) => ({ areaId, itemId: x.itemId, date: ymdToDate(target), availableQty: x.availableQty })),
        skipDuplicates: true,
      });
      copied += r.count;
    }
  }
  if (copied) logger.info({ copied }, 'stock rolled over');
}

export function startJobs() {
  cron.schedule('* * * * *', async () => {
    try {
      const n = await expireUnpaidOrders(15);
      if (n) logger.info({ n }, 'expired unpaid orders');
    } catch (err) {
      logger.error({ err }, 'expire job failed');
    }
  });
  cron.schedule(
    '5 0 * * *',
    () => rolloverStock().catch((err) => logger.error({ err }, 'rollover job failed')),
    { timezone: 'Asia/Kolkata' },
  );
  // Also on boot, in case the server was asleep at midnight (Render free tier).
  rolloverStock().catch((err) => logger.error({ err }, 'rollover on boot failed'));
}
