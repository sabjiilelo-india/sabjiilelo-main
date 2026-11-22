/**
 * One-off update for existing databases (the seed does not re-run):
 *  - every area gets one delivery window, 7 AM to 11 PM, with orders open until 10 PM
 *  - Jabalpur and Satna get a store location so customers see a delivery-time estimate
 *  - the welcome banner no longer promises "10 AM"
 *   pnpm --filter @sabjiilelo/api db:update:delivery
 *
 * Existing orders keep pointing at their old slots, so old slots are switched off rather than deleted.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COORDS: Record<string, { lat: number; lng: number }> = {
  JBP: { lat: 23.1815, lng: 79.9864 },
  SAT: { lat: 24.6005, lng: 80.8322 },
};

async function main() {
  const areas = await prisma.area.findMany({ include: { slots: true } });
  for (const area of areas) {
    const existing = area.slots.find((s) => s.label === 'Delivery' && s.startTime === '07:00' && s.endTime === '23:00');
    if (existing) {
      await prisma.deliverySlot.update({ where: { id: existing.id }, data: { isActive: true, cutoffMinutesBefore: 60, capacity: 400, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], sort: 0 } });
    } else {
      await prisma.deliverySlot.create({
        data: { areaId: area.id, label: 'Delivery', startTime: '07:00', endTime: '23:00', cutoffMinutesBefore: 60, capacity: 400, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], sort: 0 },
      });
    }
    const off = area.slots.filter((s) => s.id !== existing?.id && s.isActive);
    if (off.length) await prisma.deliverySlot.updateMany({ where: { id: { in: off.map((s) => s.id) } }, data: { isActive: false } });
    const c = COORDS[area.code];
    if (c && area.lat == null) await prisma.area.update({ where: { id: area.id }, data: c });
    console.log(`${area.code}: delivery window 7 AM - 11 PM${c ? ', store location set' : ''}${off.length ? `, ${off.length} old slot(s) switched off` : ''}`);
  }
  const banners = await prisma.banner.updateMany({
    where: { subtitle: { contains: '10 AM' } },
    data: { subtitle: 'Fresh vegetables and fruits, delivered 7 AM to 11 PM' },
  });
  console.log(`Banners updated: ${banners.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
