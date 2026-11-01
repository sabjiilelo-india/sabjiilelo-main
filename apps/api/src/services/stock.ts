import { ymdToDate } from '@sabjiilelo/shared';
import { prisma, type Tx } from '../lib/prisma';
import { badRequest } from '../lib/errors';

/** Remaining sellable base qty per item for a delivery date. Missing rows mean not stocked (0). */
export async function remainingByItem(areaId: string, date: string, itemIds?: string[]): Promise<Map<string, number>> {
  const rows = await prisma.dailyStock.findMany({
    where: { areaId, date: ymdToDate(date), ...(itemIds ? { itemId: { in: itemIds } } : {}) },
  });
  return new Map(rows.map((r) => [r.itemId, Math.max(0, r.availableQty - r.reservedQty)]));
}

/**
 * Reserves stock for each item atomically. The conditional UPDATE only succeeds while
 * enough stock remains, so two customers can never both buy the last kilo.
 */
export async function reserveStock(tx: Tx, areaId: string, date: string, needs: Map<string, { qty: number; name: string }>) {
  const d = ymdToDate(date);
  for (const [itemId, { qty, name }] of needs) {
    if (qty <= 0) continue;
    const updated = await tx.$executeRaw`
      UPDATE "DailyStock" SET "reservedQty" = "reservedQty" + ${qty}, "updatedAt" = NOW()
      WHERE "itemId" = ${itemId} AND "date" = ${d} AND "areaId" = ${areaId}
        AND "availableQty" - "reservedQty" >= ${qty}`;
    if (updated === 0) throw badRequest(`${name} is sold out for this delivery date. Please reduce the quantity or remove it.`);
  }
}

/** Returns reserved stock (cancellations, shortages, doorstep rejections). Never drops below zero. */
export async function releaseStock(tx: Tx, areaId: string, date: Date, itemId: string, qty: number) {
  if (qty <= 0) return;
  await tx.$executeRaw`
    UPDATE "DailyStock" SET "reservedQty" = GREATEST(0, "reservedQty" - ${qty}), "updatedAt" = NOW()
    WHERE "itemId" = ${itemId} AND "date" = ${date} AND "areaId" = ${areaId}`;
}

/** Books one unit of slot capacity atomically, creating the booking row on first use. */
export async function bookSlot(tx: Tx, slotId: string, date: string, capacity: number) {
  const d = ymdToDate(date);
  await tx.slotBooking.upsert({ where: { slotId_date: { slotId, date: d } }, update: {}, create: { slotId, date: d, used: 0 } });
  const updated = await tx.$executeRaw`
    UPDATE "SlotBooking" SET "used" = "used" + 1 WHERE "slotId" = ${slotId} AND "date" = ${d} AND "used" < ${capacity}`;
  if (updated === 0) throw badRequest('This delivery slot just filled up. Please pick another slot.');
}

export async function releaseSlot(tx: Tx, slotId: string | null, date: Date | null) {
  if (!slotId || !date) return;
  await tx.$executeRaw`UPDATE "SlotBooking" SET "used" = GREATEST(0, "used" - 1) WHERE "slotId" = ${slotId} AND "date" = ${date}`;
}
