import { financialYear, todayIST } from '@sabjiilelo/shared';
import type { Tx } from '../lib/prisma';

/** Atomic per-area counters. Must run inside the caller's transaction. */
export async function nextOrderNo(tx: Tx, areaId: string): Promise<string> {
  const a = await tx.area.update({ where: { id: areaId }, data: { orderSeq: { increment: 1 } }, select: { code: true, orderSeq: true } });
  return `${a.code}${String(a.orderSeq).padStart(6, '0')}`;
}

export async function nextPoNo(tx: Tx, areaId: string): Promise<string> {
  const a = await tx.area.update({ where: { id: areaId }, data: { poSeq: { increment: 1 } }, select: { code: true, poSeq: true } });
  return `PO-${a.code}-${String(a.poSeq).padStart(5, '0')}`;
}

/** Bill of Supply numbers: {AREA}/{FY}/{seq}, restarting every financial year. */
export async function nextInvoiceNo(tx: Tx, areaId: string): Promise<string> {
  const fy = financialYear(todayIST());
  const current = await tx.area.findUniqueOrThrow({ where: { id: areaId }, select: { invoiceFy: true } });
  const a = await tx.area.update({
    where: { id: areaId },
    data: current.invoiceFy === fy ? { invoiceSeq: { increment: 1 } } : { invoiceFy: fy, invoiceSeq: 1 },
    select: { code: true, invoiceSeq: true },
  });
  return `${a.code}/${fy}/${String(a.invoiceSeq).padStart(5, '0')}`;
}
