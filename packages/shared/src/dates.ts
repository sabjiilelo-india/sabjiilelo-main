/** Business runs on India Standard Time (UTC+05:30, no DST). Dates travel as "YYYY-MM-DD". */
const IST_OFFSET_MIN = 330;

export function ymdIST(at: Date = new Date()): string {
  return new Date(at.getTime() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

export function todayIST(): string {
  return ymdIST();
}

export function addDays(ymd: string, days: number): string {
  const d = ymdToDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" -> Date at UTC midnight (how @db.Date columns round-trip). */
export function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function dateToYmd(d: Date | string): string {
  return (typeof d === 'string' ? new Date(d) : d).toISOString().slice(0, 10);
}

/** Absolute instant of a local IST wall-clock time on a given date. */
export function istInstant(ymd: string, hhmm: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, hh!, mm!) - IST_OFFSET_MIN * 60_000);
}

export function slotCutoff(ymd: string, startTime: string, cutoffMinutesBefore: number): Date {
  return new Date(istInstant(ymd, startTime).getTime() - cutoffMinutesBefore * 60_000);
}

/** 0 = Sunday, matching JS getDay(). */
export function dayOfWeek(ymd: string): number {
  return ymdToDate(ymd).getUTCDay();
}

/** Indian financial year label, e.g. 2026-11-01 -> "2026-27". */
export function financialYear(ymd: string = todayIST()): string {
  const [y, m] = ymd.split('-').map(Number);
  const start = m! >= 4 ? y! : y! - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export function formatDateLabel(ymd: string, today: string = todayIST()): string {
  if (ymd === today) return 'Today';
  if (ymd === addDays(today, 1)) return 'Tomorrow';
  return ymdToDate(ymd).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h! >= 12 ? 'PM' : 'AM';
  const hr = h! % 12 || 12;
  return m ? `${hr}:${String(m).padStart(2, '0')} ${suffix}` : `${hr} ${suffix}`;
}
