import type { UnitType } from './enums';

/**
 * All stock and quantities are stored as integers in a base unit:
 * KG / GRAM -> grams, LITRE -> millilitres, everything else -> count.
 * Vendor rates and price boards are quoted per "rate unit" (per kg, per litre, per piece...).
 */
const RATE_FACTOR: Record<UnitType, number> = {
  KG: 1000,
  GRAM: 1000,
  LITRE: 1000,
  PIECE: 1,
  BUNCH: 1,
  DOZEN: 1,
  PACK: 1,
};

const RATE_UNIT_LABEL: Record<UnitType, string> = {
  KG: 'kg',
  GRAM: 'kg',
  LITRE: 'L',
  PIECE: 'pc',
  BUNCH: 'bunch',
  DOZEN: 'dozen',
  PACK: 'pack',
};

export const UNIT_LABEL: Record<UnitType, string> = {
  KG: 'Kilogram',
  GRAM: 'Gram',
  LITRE: 'Litre',
  PIECE: 'Piece',
  BUNCH: 'Bunch',
  DOZEN: 'Dozen',
  PACK: 'Pack',
};

export function rateFactor(unit: UnitType): number {
  return RATE_FACTOR[unit];
}

export function rateUnitLabel(unit: UnitType): string {
  return RATE_UNIT_LABEL[unit];
}

/** Base quantity -> human text, e.g. (KG, 1500) -> "1.5 kg", (KG, 250) -> "250 g". */
export function formatQty(unit: UnitType, baseQty: number): string {
  const n = Number(baseQty) || 0;
  switch (unit) {
    case 'KG':
    case 'GRAM':
      return Math.abs(n) >= 1000 ? `${trim(n / 1000)} kg` : `${trim(n)} g`;
    case 'LITRE':
      return Math.abs(n) >= 1000 ? `${trim(n / 1000)} L` : `${trim(n)} ml`;
    case 'PIECE':
      return `${trim(n)} pc`;
    case 'BUNCH':
      return `${trim(n)} ${n === 1 ? 'bunch' : 'bunches'}`;
    case 'DOZEN':
      return `${trim(n)} dozen`;
    case 'PACK':
      return `${trim(n)} ${n === 1 ? 'pack' : 'packs'}`;
  }
}

/** Value typed in "rate units" (e.g. 2.5 kg) -> base integer (2500 g). */
export function toBaseQty(unit: UnitType, displayQty: number): number {
  return Math.round(displayQty * RATE_FACTOR[unit]);
}

/** Base integer -> value in rate units (2500 g -> 2.5). */
export function fromBaseQty(unit: UnitType, baseQty: number): number {
  return baseQty / RATE_FACTOR[unit];
}

/** Cost of a base quantity at a per-rate-unit price. */
export function costPaise(unit: UnitType, baseQty: number, ratePaise: number): number {
  return Math.round((baseQty / RATE_FACTOR[unit]) * ratePaise);
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, '');
}
