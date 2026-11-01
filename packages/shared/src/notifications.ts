import type { Role } from './enums';

export type NotificationTarget = { kind: 'order'; id: string } | { kind: 'po'; id: string } | { kind: 'deliveries' } | null;

/** What a notification points at, read from its payload. Both the app and the website route from this. */
export function notificationTarget(data: unknown): NotificationTarget {
  const d = (data ?? {}) as { orderId?: unknown; poId?: unknown; screen?: unknown };
  if (typeof d.orderId === 'string') return { kind: 'order', id: d.orderId };
  if (typeof d.poId === 'string') return { kind: 'po', id: d.poId };
  if (d.screen === 'deliveries') return { kind: 'deliveries' };
  return null;
}

/** Website path for a notification target, by the viewer's role. */
export function webPathFor(role: Role | undefined, t: NotificationTarget): string | null {
  if (!t) return null;
  if (t.kind === 'deliveries') return '/dashboard/deliveries';
  if (t.kind === 'order') return role === 'CUSTOMER' ? `/orders/${t.id}` : role === 'DELIVERY' ? `/dashboard/deliveries/${t.id}` : `/dashboard/orders/${t.id}`;
  return role === 'VENDOR' ? `/dashboard/vendor/orders/${t.id}` : `/dashboard/supply/pos/${t.id}`;
}

/** App route for a notification target, by the viewer's role. */
export function appPathFor(role: Role | undefined, t: NotificationTarget): string | null {
  if (!t) return null;
  if (t.kind === 'deliveries') return '/(delivery)';
  if (t.kind === 'order') return role === 'DELIVERY' ? `/delivery/${t.id}` : `/order/${t.id}`;
  return role === 'VENDOR' ? `/vendor-po/${t.id}` : null;
}
