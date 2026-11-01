import type { Prisma } from '@prisma/client';
import { costPaise, type LedgerEntry, type PurchaseOrder } from '@sabjiilelo/shared';
import { ymd } from '../lib/http';

export const poInclude = {
  vendor: { select: { businessName: true } },
  items: { include: { item: { select: { name: true, unitType: true } } } },
} satisfies Prisma.PurchaseOrderInclude;
type PoFull = Prisma.PurchaseOrderGetPayload<{ include: typeof poInclude }>;

/** PO value: received qty once goods are in, else accepted, else ordered. */
export function poLineQty(i: { orderedQty: number; acceptedQty: number | null; receivedQty: number | null }) {
  return i.receivedQty ?? i.acceptedQty ?? i.orderedQty;
}

export function toPo(p: PoFull): PurchaseOrder {
  return {
    id: p.id,
    poNo: p.poNo,
    vendorId: p.vendorId,
    vendorName: p.vendor.businessName,
    forDate: ymd(p.forDate)!,
    status: p.status,
    note: p.note,
    vendorNote: p.vendorNote,
    createdAt: p.createdAt.toISOString(),
    items: p.items.map((i) => ({
      id: i.id,
      itemId: i.itemId,
      name: i.item.name,
      unitType: i.item.unitType,
      orderedQty: i.orderedQty,
      acceptedQty: i.acceptedQty,
      receivedQty: i.receivedQty,
      ratePaise: i.ratePaise,
    })),
    totalPaise: p.items.reduce((s, i) => s + costPaise(i.item.unitType, poLineQty(i), i.ratePaise), 0),
  };
}

export function toLedger(l: Prisma.VendorLedgerGetPayload<{ include: { po: { select: { poNo: true } } } }>): LedgerEntry {
  return {
    id: l.id,
    type: l.type,
    amountPaise: l.amountPaise,
    poNo: l.po?.poNo ?? null,
    reference: l.reference,
    note: l.note,
    createdAt: l.createdAt.toISOString(),
  };
}
