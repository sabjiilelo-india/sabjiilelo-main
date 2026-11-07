import {
  addDays,
  dayOfWeek,
  istInstant,
  slotCutoff,
  todayIST,
  ymdToDate,
  type SlotOption,
} from '@sabjiilelo/shared';
import { prisma } from '../lib/prisma';

/** Upcoming slot choices for an area. Unavailable ones are included so the UI can show them disabled. */
export async function slotOptions(areaId: string, days = 3, now = new Date()): Promise<SlotOption[]> {
  const today = todayIST();
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i));
  const [slots, bookings] = await Promise.all([
    prisma.deliverySlot.findMany({ where: { areaId, isActive: true }, orderBy: [{ sort: 'asc' }, { startTime: 'asc' }] }),
    prisma.slotBooking.findMany({ where: { slot: { areaId }, date: { in: dates.map(ymdToDate) } } }),
  ]);
  if (!slots.length) return [];
  const used = new Map(bookings.map((b) => [`${b.slotId}:${b.date.toISOString().slice(0, 10)}`, b.used]));

  const out: SlotOption[] = [];
  for (const date of dates) {
    for (const s of slots) {
      if (!s.daysOfWeek.includes(dayOfWeek(date))) continue;
      if (istInstant(date, s.endTime) <= now) continue;
      const cutoffAt = slotCutoff(date, s.startTime, s.cutoffMinutesBefore);
      const remaining = Math.max(0, s.capacity - (used.get(`${s.id}:${date}`) ?? 0));
      out.push({
        slotId: s.id,
        date,
        label: s.label,
        startTime: s.startTime,
        endTime: s.endTime,
        cutoffAt: cutoffAt.toISOString(),
        remaining,
        available: now < cutoffAt && remaining > 0,
      });
    }
  }
  return out;
}

export async function nextAvailableSlot(areaId: string): Promise<SlotOption | null> {
  return (await slotOptions(areaId, 4)).find((o) => o.available) ?? null;
}

/** The delivery date the catalog shows stock for: the next bookable slot's date. */
export async function catalogDate(areaId: string): Promise<{ date: string; nextSlot: SlotOption | null }> {
  const nextSlot = await nextAvailableSlot(areaId);
  return { date: nextSlot?.date ?? addDays(todayIST(), 1), nextSlot };
}

/** Whether a customer can still cancel: before the cutoff of the order's slot. */
export async function beforeCutoff(slotId: string | null, slotDate: Date | null, now = new Date()): Promise<boolean> {
  if (!slotId || !slotDate) return false;
  const slot = await prisma.deliverySlot.findUnique({ where: { id: slotId } });
  if (!slot) return false;
  return now < slotCutoff(slotDate.toISOString().slice(0, 10), slot.startTime, slot.cutoffMinutesBefore);
}
