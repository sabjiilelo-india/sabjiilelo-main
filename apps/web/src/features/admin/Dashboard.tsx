import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Banknote, Bike, Package, RotateCcw, Star } from 'lucide-react';
import { qk } from '@sabjiilelo/api-client';
import { ORDER_STATUS_LABEL, addDays, formatDateLabel, formatINR, todayIST, type OrderStatus } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Badge, Card, Input, PageHeader, PageLoader, StatCard, Tabs } from '../../components/ui';

export function Dashboard() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayIST());
  const q = useQuery({ queryKey: qk.dashboard(date), queryFn: () => api.reports.dashboard(date), refetchInterval: 60_000 });
  const d = q.data;
  const pipeline: OrderStatus[] = ['PLACED', 'CONFIRMED', 'PACKING', 'PACKED', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PARTIALLY_DELIVERED', 'CANCELLED'];

  return (
    <>
      <PageHeader
        title={`${user?.area?.name ?? ''} dashboard`}
        subtitle={`Orders for delivery ${formatDateLabel(date).toLowerCase()}`}
        actions={
          <>
            <Tabs
              value={date === todayIST() ? 'today' : date === addDays(todayIST(), 1) ? 'tomorrow' : 'other'}
              onChange={(v) => setDate(v === 'today' ? todayIST() : addDays(todayIST(), 1))}
              options={[
                { value: 'today', label: 'Today' },
                { value: 'tomorrow', label: 'Tomorrow' },
              ]}
            />
            <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-40" />
          </>
        }
      />
      {!d ? (
        <PageLoader />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Orders" value={d.ordersCount} hint={`${d.activeOrders} still in progress`} icon={<Package size={18} />} />
            <StatCard label="Order value" value={formatINR(d.revenuePaise)} icon={<Banknote size={18} />} />
            <StatCard label="Riders online" value={d.onlineRiders} icon={<Bike size={18} />} tone="orange" />
            <StatCard label="Avg. rating" value={d.avgRating ? d.avgRating.toFixed(1) + ' ★' : '—'} icon={<Star size={18} />} tone="orange" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <h2 className="mb-4 text-base">Order pipeline</h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {pipeline.map((s) => (
                  <Link key={s} to={`/dashboard/orders?status=${s}&date=${date}`} className="rounded-xl bg-cream p-3 transition hover:bg-light-green">
                    <div className="text-2xl font-semibold text-ink">{d.statusCounts[s] ?? 0}</div>
                    <div className="text-xs text-muted">{ORDER_STATUS_LABEL[s]}</div>
                  </Link>
                ))}
              </div>
              <h3 className="mb-2 mt-6 text-sm">By slot</h3>
              <div className="space-y-2">
                {d.ordersBySlot.map((s) => {
                  const max = Math.max(1, ...d.ordersBySlot.map((x) => x.count));
                  return (
                    <div key={s.label} className="flex items-center gap-3 text-sm">
                      <span className="w-20 shrink-0 text-muted">{s.label}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-beige">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(s.count / max) * 100}%` }} />
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
                <div className="space-y-2 text-sm">
                  <Link to="/dashboard/accounts/refunds" className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-cream">
                    <span className="flex items-center gap-2">
                      <RotateCcw size={16} /> Refunds to approve
                    </span>
                    <Badge tone={d.pendingRefunds ? 'orange' : 'gray'}>{d.pendingRefunds}</Badge>
                  </Link>
                  <Link to="/dashboard/accounts/issues" className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-cream">
                    <span>Customer issues</span>
                    <Badge tone={d.openIssues ? 'orange' : 'gray'}>{d.openIssues}</Badge>
                  </Link>
                </div>
              </Card>
              <Card className="p-5">
                <h2 className="mb-3 text-base">Sold out ({d.soldOutItems.length})</h2>
                {d.soldOutItems.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {d.soldOutItems.map((i) => (
                      <Badge key={i.itemId} tone="red">
                        {i.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">Everything in stock 🎉</p>
                )}
                <Link to="/dashboard/stock" className="mt-3 inline-block text-sm font-medium text-primary">
                  Update stock →
                </Link>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
