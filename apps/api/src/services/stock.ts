import { randomUUID } from 'node:crypto';
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
 * Reserves stock for every item in ONE statement. The conditional UPDATE only matches rows that
 * still have enough stock, so two customers can never both buy the last kilo; if any item falls
 * short the whole transaction rolls back and we look up which one to name in the message.
 */
export async function reserveStock(tx: Tx, areaId: string, date: string, needs: Map<string, { qty: number; name: string }>) {
  const entries = [...needs].filter(([, n]) => n.qty > 0);
  if (!entries.length) return;
  const ids = entries.map(([id]) => id);
  const qtys = entries.map(([, n]) => n.qty);
  const d = ymdToDate(date);
  const updated = await tx.$executeRaw`
    UPDATE "DailyStock" ds SET "reservedQty" = ds."reservedQty" + v.qty, "updatedAt" = NOW()
    FROM unnest(${ids}::text[], ${qtys}::int[]) AS v(id, qty)
    WHERE ds."itemId" = v.id AND ds."date" = ${d} AND ds."areaId" = ${areaId}
      AND ds."availableQty" - ds."reservedQty" >= v.qty`;
  if (updated !== entries.length) {
    const rows = await tx.dailyStock.findMany({ where: { areaId, date: d, itemId: { in: ids } } });
    const short = entries.find(([id, n]) => {
      const r = rows.find((x) => x.itemId === id);
      return !r || r.availableQty - r.reservedQty < n.qty;
    });
    throw badRequest(`${short?.[1].name ?? 'An item'} is sold out for this delivery date. Please reduce the quantity or remove it.`);
  }
}

/** Returns reserved stock (cancellations, shortages, doorstep rejections). Never drops below zero. */
export async function releaseStock(tx: Tx, areaId: string, date: Date, itemId: string, qty: number) {
  if (qty <= 0) return;
  await tx.$executeRaw`
    UPDATE "DailyStock" SET "reservedQty" = GREATEST(0, "reservedQty" - ${qty}), "updatedAt" = NOW()
    WHERE "itemId" = ${itemId} AND "date" = ${date} AND "areaId" = ${areaId}`;
}

/** Books one unit of slot capacity atomically (insert-or-increment in a single statement). */
export async function bookSlot(tx: Tx, slotId: string, date: string, capacity: number) {
  const d = ymdToDate(date);
  const booked = await tx.$executeRaw`
    INSERT INTO "SlotBooking" ("id", "slotId", "date", "used") VALUES (${randomUUID()}, ${slotId}, ${d}, 1)
    ON CONFLICT ("slotId", "date") DO UPDATE SET "used" = "SlotBooking"."used" + 1
    WHERE "SlotBooking"."used" < ${capacity}`;
  if (booked === 0) throw badRequest('This delivery slot just filled up. Please pick another slot.');
}

export async function releaseSlot(tx: Tx, slotId: string | null, date: Date | null) {
  if (!slotId || !date) return;
  await tx.$executeRaw`UPDATE "SlotBooking" SET "used" = GREATEST(0, "used" - 1) WHERE "slotId" = ${slotId} AND "date" = ${date}`;
}
