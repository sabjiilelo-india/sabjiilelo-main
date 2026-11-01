import type { OrderStatus, Role } from './enums';

type Transition = { to: OrderStatus; roles: readonly Role[] };

const OPS = ['ADMIN', 'MANAGER'] as const;

/** An empty roles list means only the system (payments, cron) may make the move. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly Transition[]> = {
  PAYMENT_PENDING: [
    { to: 'PLACED', roles: [] },
    { to: 'CANCELLED', roles: ['CUSTOMER', ...OPS] },
  ],
  PLACED: [
    { to: 'CONFIRMED', roles: OPS },
    { to: 'CANCELLED', roles: ['CUSTOMER', ...OPS] },
  ],
  CONFIRMED: [
    { to: 'PACKING', roles: OPS },
    { to: 'PACKED', roles: OPS },
    { to: 'CANCELLED', roles: ['CUSTOMER', ...OPS] },
  ],
  PACKING: [
    { to: 'PACKED', roles: OPS },
    { to: 'CANCELLED', roles: OPS },
  ],
  PACKED: [
    { to: 'ASSIGNED', roles: OPS },
    { to: 'CANCELLED', roles: OPS },
  ],
  ASSIGNED: [
    { to: 'OUT_FOR_DELIVERY', roles: ['DELIVERY'] },
    { to: 'PACKED', roles: OPS },
    { to: 'CANCELLED', roles: OPS },
  ],
  OUT_FOR_DELIVERY: [
    { to: 'DELIVERED', roles: ['DELIVERY'] },
    { to: 'PARTIALLY_DELIVERED', roles: ['DELIVERY'] },
    { to: 'CANCELLED', roles: ['DELIVERY', ...OPS] },
  ],
  DELIVERED: [],
  PARTIALLY_DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus, role: Role | 'SYSTEM'): boolean {
  const t = ORDER_TRANSITIONS[from].find((x) => x.to === to);
  if (!t) return false;
  return role === 'SYSTEM' || t.roles.includes(role);
}

export function nextStatuses(from: OrderStatus, role: Role): OrderStatus[] {
  return ORDER_TRANSITIONS[from].filter((t) => t.roles.includes(role)).map((t) => t.to);
}

export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  'PLACED',
  'CONFIRMED',
  'PACKING',
  'PACKED',
  'ASSIGNED',
  'OUT_FOR_DELIVERY',
];

/** Orders that hold stock and slot capacity. */
export const RESERVING_ORDER_STATUSES: readonly OrderStatus[] = ['PAYMENT_PENDING', ...ACTIVE_ORDER_STATUSES];

export const FINAL_ORDER_STATUSES: readonly OrderStatus[] = ['DELIVERED', 'PARTIALLY_DELIVERED', 'CANCELLED'];

/** Customer-facing progress steps for the tracking timeline. */
export const TRACKING_STEPS: readonly OrderStatus[] = ['PLACED', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export function trackingStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'PAYMENT_PENDING':
      return -1;
    case 'PACKING':
      return 1;
    case 'ASSIGNED':
      return 2;
    case 'PARTIALLY_DELIVERED':
      return 4;
    default:
      return TRACKING_STEPS.indexOf(status);
  }
}
