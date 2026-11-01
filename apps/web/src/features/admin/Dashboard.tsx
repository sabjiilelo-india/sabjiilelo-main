import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Banknote, Bike, Boxes, CalendarClock, ClipboardList, PackageCheck, Plus, Receipt, RotateCcw, ShoppingBag, Star, Users } from 'lucide-react';
import clsx from 'clsx';
import { qk } from '@sabjiilelo/api-client';
import { ORDER_STATUS_LABEL, addDays, can, formatDateLabel, formatINR, todayIST, type OrderStatus } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Badge, Card, ErrorState, Input, PageHeader, Skeleton, Tabs } from '../../components/ui';

function Kpi({ to, label, value, hint, icon, tone = 'green' }: { to: string; label: string; value: ReactNode; hint?: ReactNode; icon: ReactNode; tone?: 'green' | 'orange' | 'red' | 'blue' }) {
  const tones = {
    green: 'bg-light-green text-primary',
    orange: 'bg-accent/15 text-[#c25a14]',
    red: 'bg-danger/10 text-danger',
    blue: 'bg-sky-100 text-sky-700',
  };
  return (
    <Link to={to} className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift">
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        <span className={clsx('rounded-xl p-2', tones[tone])}>{icon}</span>
      </div>
      <div className="mt-2 text-[28px] font-bold leading-tight text-ink">{value}</div>
      <div className="mt-1 flex items-center justify-between text-xs text-muted">
        <span>{hint}</span>
        <ArrowRight size={14} className="opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
      </div>
    </Link>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayIST());
  const q = useQuery({ queryKey: qk.dashboard(date), queryFn: () => api.reports.dashboard(date), refetchInterval: 60_000 });
  const d = q.data;
  const pipeline: OrderStatus[] = ['PLACED', 'CONFIRMED', 'PACKING', 'PACKED', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PARTIALLY_DELIVERED', 'CANCELLED'];
  const isAdmin = user?.role === 'ADMIN';
  const maxDay = Math.max(1, ...(d?.last7Days.map((x) => x.valuePaise) ?? [1]));
  const tab = date === todayIST() ? 'today' : date === addDays(todayIST(), 1) ? 'tomorrow' : 'other';

  return (
    <>
      <PageHeader
        title={`${user?.area?.name ?? ''} dashboard`}
        subtitle={`Live view for delivery ${formatDateLabel(date).toLowerCase()} · refreshes every minute`}
        actions={
          <>
            <Tabs
              value={tab}
              onChange={(v) => setDate(v === 'tomorrow' ? addDays(todayIST(), 1) : todayIST())}
              options={[
                { value: 'today', label: 'Today' },
                { value: 'tomorrow', label: 'Tomorrow' },
              ]}
            />
            <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-40" />
          </>
        }
      />
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !d ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {d.ordersCount === 0 && d.placedToday.count === 0 && d.nextDay.count === 0 && (
            <Card className="flex flex-wrap items-center gap-4 bg-gradient-to-r from-mint to-light-green p-5">
              <img src="/icons/basket.webp" alt="" className="h-14 w-14" />
              <div className="flex-1">
                <div className="font-semibold text-ink">No orders yet — let's get the shop ready</div>
                <div className="text-sm text-muted">Make sure today's stock and prices are set so customers can order. New orders will appear here instantly.</div>
              </div>
              <div className="flex gap-2">
                <Link to="/dashboard/stock" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">
                  Set stock
                </Link>
                <Link to="/dashboard/prices" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-primary">
                  Update prices
                </Link>
              </div>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi to={`/dashboard/orders?date=${date}`} label={`Orders · ${formatDateLabel(date)}`} value={d.ordersCount} hint={`${d.activeOrders} in progress`} icon={<ShoppingBag size={18} />} />
            <Kpi to={`/dashboard/orders?date=${date}`} label="Order value" value={formatINR(d.revenuePaise)} hint={`Avg ${d.ordersCount ? formatINR(Math.round(d.revenuePaise / d.ordersCount)) : '—'} per order`} icon={<Banknote size={18} />} />
            <Kpi to="/dashboard/orders" label="Placed today" value={d.placedToday.count} hint={`${formatINR(d.placedToday.valuePaise)} · any slot`} icon={<Receipt size={18} />} tone="blue" />
            <Kpi
              to={`/dashboard/orders?date=${d.nextDay.date}`}
              label={`For ${formatDateLabel(d.nextDay.date).toLowerCase()}`}
              value={d.nextDay.count}
              hint={formatINR(d.nextDay.valuePaise)}
              icon={<CalendarClock size={18} />}
              tone="orange"
            />
            <Kpi to="/dashboard/stock" label="Items in stock" value={`${d.catalog.inStock}/${d.catalog.items}`} hint={d.catalog.notStocked ? `${d.catalog.notStocked} not stocked yet` : `${d.catalog.soldOut} sold out`} icon={<Boxes size={18} />} tone={d.catalog.soldOut || d.catalog.notStocked ? 'orange' : 'green'} />
            <Kpi to="/dashboard/dispatch" label="Riders online" value={`${d.onlineRiders}/${d.team.riders}`} hint="Delivery partners" icon={<Bike size={18} />} tone="blue" />
            <Kpi to="/dashboard/accounts/cod" label="Cash to collect" value={formatINR(d.codPendingPaise)} hint="COD with riders" icon={<Banknote size={18} />} tone={d.codPendingPaise ? 'orange' : 'green'} />
            <Kpi to="/dashboard/feedback" label="Customer rating" value={d.avgRating ? `${d.avgRating.toFixed(1)} ★` : '—'} hint={`${d.ratingsCount} ratings`} icon={<Star size={18} />} tone="orange" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base">Order pipeline</h2>
                <Link to={`/dashboard/orders?date=${date}`} className="text-sm font-semibold text-primary">
                  Open board →
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
                {pipeline.map((s) => {
                  const n = d.statusCounts[s] ?? 0;
                  return (
                    <Link
                      key={s}
                      to={`/dashboard/orders?status=${s}&date=${date}`}
                      className={clsx('rounded-2xl p-3 transition hover:-translate-y-0.5', n ? (s === 'CANCELLED' ? 'bg-danger/10' : 'bg-light-green') : 'bg-cream')}
                    >
                      <div className={clsx('text-2xl font-bold', n ? 'text-ink' : 'text-muted/60')}>{n}</div>
                      <div className="text-[11px] leading-tight text-muted">{ORDER_STATUS_LABEL[s]}</div>
                    </Link>
                  );
                })}
              </div>

              <h3 className="mb-3 mt-6 text-sm">Last 7 days (by delivery date)</h3>
              <div className="flex h-40 items-end gap-2">
                {d.last7Days.map((x) => (
                  <div key={x.date} className="group flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] font-medium text-muted opacity-0 transition group-hover:opacity-100">{formatINR(x.valuePaise)}</span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className={clsx('w-full rounded-t-lg transition-all', x.date === date ? 'bg-primary' : 'bg-primary/35 group-hover:bg-primary/60')}
                        style={{ height: `${Math.max(4, (x.valuePaise / maxDay) * 100)}%` }}
                        title={`${x.orders} orders · ${formatINR(x.valuePaise)}`}
                      />
                    </div>
                    <span className="text-[11px] text-muted">{new Date(x.date + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' })}</span>
                    <span className="text-[11px] font-semibold text-ink">{x.orders}</span>
                  </div>
                ))}
              </div>

              <h3 className="mb-2 mt-6 text-sm">By slot · {formatDateLabel(date)}</h3>
              <div className="space-y-2">
                {d.ordersBySlot.map((s) => {
                  const max = Math.max(1, ...d.ordersBySlot.map((x) => x.count));
                  return (
                    <div key={s.label} className="flex items-center gap-3 text-sm">
                      <span className="w-20 shrink-0 text-muted">{s.label}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-beige">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(s.count / max) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right font-semibold">{s.count}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="space-y-4">
              <Card className="p-5">
                <h2 className="mb-3 flex items-center gap-2 text-base">
                  <AlertTriangle size={18} className="text-accent" /> Needs attention
                </h2>
                <div className="space-y-1 text-sm">
                  {[
                    { to: '/dashboard/accounts/refunds', label: 'Refunds to approve', n: d.pendingRefunds, icon: RotateCcw, show: can(user?.role, 'accounts') },
                    { to: '/dashboard/accounts/issues', label: 'Customer issues', n: d.openIssues, icon: AlertTriangle, show: can(user?.role, 'accounts') },
                    { to: '/dashboard/supply/pos', label: 'Open purchase orders', n: d.pendingPos, icon: PackageCheck, show: true },
                    { to: `/dashboard/orders?status=PLACED&date=${date}`, label: 'New orders to confirm', n: d.statusCounts.PLACED ?? 0, icon: ClipboardList, show: true },
                  ]
                    .filter((x) => x.show)
                    .map(({ icon: Icon, ...x }) => (
                      <Link key={x.to} to={x.to} className="flex items-center justify-between rounded-xl px-2 py-2 hover:bg-cream">
                        <span className="flex items-center gap-2">
                          <Icon size={16} className="text-muted" /> {x.label}
                        </span>
                        <Badge tone={x.n ? 'orange' : 'gray'}>{x.n}</Badge>
                      </Link>
                    ))}
                </div>
              </Card>

              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base">Sold out ({d.soldOutItems.length})</h2>
                  <Link to="/dashboard/stock" className="text-sm font-semibold text-primary">
                    Update →
                  </Link>
                </div>
                {d.soldOutItems.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {d.soldOutItems.slice(0, 12).map((i) => (
                      <Badge key={i.itemId} tone="red">
                        {i.name}
                      </Badge>
                    ))}
                  </div>
                ) : d.catalog.notStocked ? (
                  <p className="text-sm text-[#c25a14]">{d.catalog.notStocked} items have no stock set for this date.</p>
                ) : (
                  <p className="text-sm text-muted">Everything is in stock 🎉</p>
                )}
              </Card>

              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-base">
                    <Users size={18} className="text-primary" /> Team
                  </h2>
                  {isAdmin && (
                    <Link to="/dashboard/staff" className="text-sm font-semibold text-primary">
                      Manage →
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ['Staff', d.team.staff],
                    ['Riders', d.team.riders],
                    ['Vendors', d.team.vendors],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-cream py-2">
                      <div className="text-lg font-bold text-ink">{v}</div>
                      <div className="text-[11px] text-muted">{k}</div>
                    </div>
                  ))}
                </div>
                {isAdmin && (
                  <div className="mt-3 flex gap-2">
                    <Link to="/dashboard/staff?add=VENDOR" className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-line py-2 text-xs font-semibold text-primary hover:bg-light-green/50">
                      <Plus size={14} /> Vendor
                    </Link>
                    <Link to="/dashboard/staff?add=DELIVERY" className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-line py-2 text-xs font-semibold text-primary hover:bg-light-green/50">
                      <Plus size={14} /> Rider
                    </Link>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
