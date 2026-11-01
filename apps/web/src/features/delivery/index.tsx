import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Navigation, Phone } from 'lucide-react';
import { qk } from '@sabjiilelo/api-client';
import { DOORSTEP_REJECT_REASONS, effectiveLineQty, finalPayable, formatINR, type OrderDetail } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, EmptyState, Field, MoneyInput, PageHeader, PageLoader, Select, StatCard, StatusBadge, Tabs, Toggle } from '../../components/ui';
import { ImageUpload } from '../../components/ImageUpload';
import { toast } from '../../components/toast';
import { confirm } from '../../components/confirm';

export default function Delivery({ page }: { page: 'list' | 'order' }) {
  return page === 'list' ? <MyDeliveries /> : <DeliveryOrder />;
}

function MyDeliveries() {
  const { user, setUser } = useAuth();
  const [scope, setScope] = useState<'active' | 'done'>('active');
  const q = useQuery({ queryKey: qk.riderOrders(scope), queryFn: () => api.rider.orders(scope), refetchInterval: 30_000 });
  const cash = useQuery({ queryKey: qk.riderCash(), queryFn: () => api.rider.cash() });
  const online = useMutation({ mutationFn: (v: boolean) => api.rider.setOnline(v), onSuccess: (r) => user && setUser({ ...user, isOnline: r.isOnline }) });
  return (
    <>
      <PageHeader title="My deliveries" actions={<Toggle checked={!!user?.isOnline} onChange={(v) => online.mutate(v)} label={user?.isOnline ? 'Online' : 'Offline'} />} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Delivered today" value={cash.data?.deliveredCount ?? 0} />
        <StatCard label="Cash in hand" value={formatINR(Math.max(0, (cash.data?.codExpectedPaise ?? 0) - (cash.data?.depositedPaise ?? 0)))} hint={`Collected ${formatINR(cash.data?.codExpectedPaise ?? 0)} today`} tone="orange" />
        <StatCard label="Cash status" value={cash.data?.status.toLowerCase() ?? '—'} />
      </div>
      <div className="mb-4">
        <Tabs value={scope} onChange={setScope} options={[{ value: 'active', label: 'To deliver' }, { value: 'done', label: 'Done today' }]} />
      </div>
      {q.isLoading ? (
        <PageLoader />
      ) : !q.data?.length ? (
        <EmptyState icon="/icons/truck.webp" title={scope === 'active' ? 'No deliveries assigned' : 'Nothing delivered yet today'} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {q.data.map((o) => (
            <Link key={o.id} to={`/dashboard/deliveries/${o.id}`} className="card p-4 hover:border-primary/40">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">#{o.orderNo}</span>
                <StatusBadge status={o.status} />
              </div>
              <div className="mt-1 text-sm">{o.customerName}</div>
              <div className="text-xs text-muted">
                {o.pincode} · {o.slotLabel} · {o.itemCount} items
              </div>
              <div className="mt-2 text-sm font-semibold">{o.paymentMode === 'COD' ? `Collect ${formatINR(o.finalPayablePaise)}` : <Badge tone="green">Prepaid</Badge>}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

type Rejection = { qty: number; reason: string; photo: string[] };

export function DeliveryOrder() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.riderOrder(id!), queryFn: () => api.rider.order(id!) });
  const [rej, setRej] = useState<Record<string, Rejection>>({});
  const [cash, setCash] = useState<number | null>(null);
  const done = (o: OrderDetail) => {
    qc.setQueryData(qk.riderOrder(o.id), o);
    qc.invalidateQueries({ queryKey: ['rider'] });
  };
  const start = useMutation({ mutationFn: () => api.rider.start(id!), onSuccess: done, onError: (e) => toast.error((e as Error).message) });
  const deliver = useMutation({
    mutationFn: () =>
      api.rider.deliver(id!, {
        rejections: Object.entries(rej)
          .filter(([, r]) => r.qty > 0)
          .map(([orderItemId, r]) => ({ orderItemId, qty: r.qty, reason: r.reason, photoUrl: r.photo[0] })),
        codCollectedPaise: cash ?? undefined,
      }),
    onSuccess: (o) => {
      done(o);
      toast.success('Delivered!');
      nav('/dashboard/deliveries');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (q.isLoading || !q.data) return <PageLoader />;
  const o = q.data;
  const effSubtotal = o.items.reduce((s, i) => s + i.pricePaise * Math.max(0, effectiveLineQty(i) - (rej[i.id]?.qty ?? 0)), 0);
  const payable = finalPayable(effSubtotal, o.discountPaise, o.deliveryFeePaise);
  const mapUrl = o.address
    ? o.address.lat && o.address.lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${o.address.lat},${o.address.lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${o.address.line1}, ${o.address.city} ${o.address.pincode}`)}`
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted hover:text-primary">
        <ArrowLeft size={16} /> Back
      </button>
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl">#{o.orderNo}</h1>
          <StatusBadge status={o.status} />
        </div>
        <div className="mt-3 font-medium text-ink">{o.address?.name}</div>
        <p className="flex gap-1 text-sm text-muted">
          <MapPin size={14} className="mt-0.5 shrink-0" /> {o.address?.line1}
          {o.address?.landmark ? `, ${o.address.landmark}` : ''}, {o.address?.city} – {o.address?.pincode}
        </p>
        <div className="mt-3 flex gap-2">
          {o.address?.phone && (
            <a href={`tel:${o.address.phone}`}>
              <Button variant="secondary" icon={<Phone size={16} />}>
                Call
              </Button>
            </a>
          )}
          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" icon={<Navigation size={16} />}>
                Navigate
              </Button>
            </a>
          )}
        </div>
      </Card>

      {o.status === 'ASSIGNED' && (
        <Button size="lg" block loading={start.isPending} onClick={() => start.mutate()}>
          Start delivery
        </Button>
      )}

      {o.status === 'ASSIGNED' && (
        <Card className="p-5">
          <h2 className="mb-2 text-base">Items to deliver</h2>
          <div className="divide-y divide-line/70">
            {o.items.map((i) => (
              <div key={i.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <span className="font-medium text-ink">{i.name}</span>
                  <span className="block text-xs text-muted">
                    {i.variantLabel} × {effectiveLineQty(i)}
                  </span>
                </span>
                <span className="font-semibold">{formatINR(i.pricePaise * effectiveLineQty(i))}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">{o.paymentMode === 'COD' ? `Collect ${formatINR(o.finalPayablePaise)} in cash.` : 'Prepaid, nothing to collect.'}</p>
        </Card>
      )}

      {o.status === 'OUT_FOR_DELIVERY' && (
        <>
          <Card className="p-5">
            <h2 className="text-base">Check items with the customer</h2>
            <p className="mb-3 text-xs text-muted">If anything isn't fresh, mark how many they're returning.</p>
            <div className="divide-y divide-line/70">
              {o.items.map((i) => {
                const r = rej[i.id] ?? { qty: 0, reason: DOORSTEP_REJECT_REASONS[0], photo: [] };
                const max = effectiveLineQty(i);
                return (
                  <div key={i.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-ink">{i.name}</div>
                        <div className="text-xs text-muted">
                          {i.variantLabel} × {max}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        Return
                        <Select className="w-20" value={r.qty} onChange={(e) => setRej((s) => ({ ...s, [i.id]: { ...r, qty: Number(e.target.value) } }))}>
                          {Array.from({ length: max + 1 }, (_, n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                    {r.qty > 0 && (
                      <div className="mt-2 grid gap-2 rounded-xl bg-danger/5 p-3 sm:grid-cols-2">
                        <Field label="Reason">
                          <Select value={r.reason} onChange={(e) => setRej((s) => ({ ...s, [i.id]: { ...r, reason: e.target.value } }))}>
                            {DOORSTEP_REJECT_REASONS.map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Photo">
                          <ImageUpload folder="proofs" value={r.photo} onChange={(p) => setRej((s) => ({ ...s, [i.id]: { ...r, photo: p } }))} />
                        </Field>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>{o.paymentMode === 'COD' ? 'Collect cash' : 'Prepaid'}</span>
              <span className={o.paymentMode === 'COD' ? 'text-primary' : 'text-muted'}>{formatINR(payable)}</span>
            </div>
            {o.paymentMode === 'COD' && (
              <Field label="Cash received" className="mt-3">
                <MoneyInput value={cash ?? payable} onChange={setCash} />
              </Field>
            )}
            {o.paymentMode !== 'COD' && payable < o.finalPayablePaise && <p className="mt-2 text-sm text-muted">{formatINR(o.finalPayablePaise - payable)} will be refunded to the customer.</p>}
          </Card>
          <Button size="lg" block loading={deliver.isPending} onClick={async () => (await confirm({ title: 'Mark as delivered?', message: o.paymentMode === 'COD' ? `Confirm you collected ${formatINR(cash ?? payable)} in cash.` : 'The customer will be notified.', confirmText: 'Delivered' })) && deliver.mutate()}>
            Mark delivered
          </Button>
        </>
      )}
    </div>
  );
}
