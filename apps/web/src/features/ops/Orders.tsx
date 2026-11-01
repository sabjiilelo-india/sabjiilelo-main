import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCheck, FileText, MapPin, Phone, Printer } from 'lucide-react';
import { qk } from '@sabjiilelo/api-client';
import {
  ORDER_STATUS_LABEL,
  can,
  effectiveLineQty,
  formatDateLabel,
  formatINR,
  formatQty,
  nextStatuses,
  todayIST,
  type OrderDetail,
  type OrderStatus,
} from '@sabjiilelo/shared';
import { api, openBlob } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, PageLoader, Pager, Select, StatusBadge, Table } from '../../components/ui';
import { ProduceImage } from '../../components/ProduceImage';
import { toast } from '../../components/toast';

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PLACED', label: 'New' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PACKING,PACKED', label: 'Packing' },
  { value: 'ASSIGNED,OUT_FOR_DELIVERY', label: 'On the way' },
  { value: 'DELIVERED,PARTIALLY_DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function OrdersBoard() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const date = params.get('date') ?? todayIST();
  const status = params.get('status') ?? '';
  const slotId = params.get('slotId') ?? '';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const slots = useQuery({ queryKey: qk.manageSlots, queryFn: api.manage.slots });
  const filters = { date, status, slotId, q: search, page };
  const q = useQuery({ queryKey: qk.opsOrders(filters), queryFn: () => api.ops.orders({ ...filters, pageSize: 50 }), refetchInterval: 30_000 });
  useEffect(() => setSelected([]), [date, status, slotId, page]);
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
    setPage(1);
  };
  const confirm = useMutation({
    mutationFn: () => api.ops.bulkConfirm(selected),
    onSuccess: (r) => {
      toast.success(`${r.confirmed} orders confirmed`);
      qc.invalidateQueries({ queryKey: ['ops'] });
    },
  });
  const placed = (q.data?.data ?? []).filter((o) => o.status === 'PLACED');

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={`Delivery ${formatDateLabel(date).toLowerCase()}`}
        actions={
          can(user?.role, 'operateOrders') && (
            <Button icon={<CheckCheck size={16} />} disabled={!selected.length} loading={confirm.isPending} onClick={() => confirm.mutate()}>
              Confirm {selected.length || ''} selected
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input type="date" className="w-40" value={date} onChange={(e) => set('date', e.target.value)} />
        <Select className="w-40" value={slotId} onChange={(e) => set('slotId', e.target.value)}>
          <option value="">All slots</option>
          {slots.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        <Input placeholder="Order no, phone, name" className="w-56" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => set('status', f.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${status === f.value ? 'bg-primary text-white' : 'bg-white text-body hover:bg-light-green'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {q.isLoading ? (
        <PageLoader />
      ) : !q.data?.data.length ? (
        <EmptyState icon="/icons/basket.webp" title="No orders here" text="Try another date, slot or status." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th className="w-8">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={!!placed.length && placed.every((o) => selected.includes(o.id))}
                    onChange={(e) => setSelected(e.target.checked ? placed.map((o) => o.id) : [])}
                    title="Select all new orders"
                  />
                </th>
                <th>Order</th>
                <th>Customer</th>
                <th>Slot</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Rider</th>
              </tr>
            </thead>
            <tbody>
              {q.data.data.map((o) => (
                <tr key={o.id} className="hover:bg-cream/60">
                  <td>
                    {o.status === 'PLACED' && (
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={selected.includes(o.id)}
                        onChange={(e) => setSelected((s) => (e.target.checked ? [...s, o.id] : s.filter((x) => x !== o.id)))}
                      />
                    )}
                  </td>
                  <td>
                    <Link to={`/dashboard/orders/${o.id}`} className="font-semibold text-primary hover:underline">
                      #{o.orderNo}
                    </Link>
                    <div className="text-xs text-muted">{o.channel === 'POS' ? 'Counter' : new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td>
                    <div>{o.customerName ?? 'Walk-in'}</div>
                    <div className="text-xs text-muted">
                      {o.customerPhone} {o.pincode && `· ${o.pincode}`}
                    </div>
                  </td>
                  <td>{o.slotLabel ?? '—'}</td>
                  <td>{o.itemCount}</td>
                  <td>
                    <div className="font-medium">{formatINR(o.finalPayablePaise)}</div>
                    <div className="text-xs text-muted">
                      {o.paymentMode} · {o.paymentStatus.toLowerCase()}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="text-sm">{o.riderName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager page={page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}

export function OpsOrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.opsOrder(id!), queryFn: () => api.ops.order(id!) });
  const [packing, setPacking] = useState<Record<string, number> | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const update = (o: OrderDetail) => {
    qc.setQueryData(qk.opsOrder(o.id), o);
    qc.invalidateQueries({ queryKey: ['ops', 'orders'] });
  };
  const status = useMutation({ mutationFn: (s: OrderStatus) => api.ops.setStatus(id!, s), onSuccess: update, onError: (e) => toast.error((e as Error).message) });
  const pack = useMutation({
    mutationFn: () => api.ops.pack(id!, Object.entries(packing ?? {}).map(([orderItemId, packedQty]) => ({ orderItemId, packedQty }))),
    onSuccess: (o) => {
      update(o);
      setPacking(null);
      toast.success(`Packed. Bill ${o.invoiceNo}`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (q.isLoading || !q.data) return <PageLoader />;
  const o = q.data;
  const canOperate = can(user?.role, 'operateOrders');
  const moves = canOperate ? nextStatuses(o.status, user!.role).filter((s) => !['CANCELLED', 'PACKED', 'ASSIGNED'].includes(s)) : [];
  const canPack = canOperate && ['PLACED', 'CONFIRMED', 'PACKING'].includes(o.status);
  const effSubtotal = o.items.reduce((s, i) => s + i.pricePaise * effectiveLineQty(i), 0);

  return (
    <>
      <button onClick={() => nav(-1)} className="mb-3 flex items-center gap-1 text-sm text-muted hover:text-primary">
        <ArrowLeft size={16} /> Back
      </button>
      <PageHeader
        title={`Order #${o.orderNo}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={o.status} /> {o.slotDate && `${formatDateLabel(o.slotDate)} · ${o.slot?.label ?? 'Counter'}`} · {o.channel}
          </span>
        }
        actions={
          <>
            {o.invoiceNo && (
              <Button variant="outline" icon={<FileText size={16} />} onClick={() => openBlob(api.invoices.download(o.id, 'bill'))}>
                Bill {o.invoiceNo}
              </Button>
            )}
            {o.channel !== 'POS' && (
              <Button variant="outline" icon={<Printer size={16} />} onClick={() => openBlob(api.invoices.download(o.id, 'packing-slip'))}>
                Packing slip
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base">Items</h2>
              {canPack && !packing && (
                <Button size="sm" onClick={() => setPacking(Object.fromEntries(o.items.map((i) => [i.id, i.qty])))}>
                  Start packing
                </Button>
              )}
            </div>
            <div className="divide-y divide-line/70">
              {o.items.map((i) => (
                <div key={i.id} className="flex items-center gap-3 py-3">
                  <ProduceImage src={i.image} name={i.name} className="h-12 w-12 shrink-0 rounded-xl" emojiClass="text-2xl" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink">{i.name}</div>
                    <div className="text-xs text-muted">
                      {i.variantLabel} × {i.qty} = {formatQty(i.unitType, i.baseQty * i.qty)}
                    </div>
                    {i.packedQty != null && i.packedQty < i.qty && <Badge tone="orange">Short {i.qty - i.packedQty}</Badge>}
                    {i.rejectedQty > 0 && (
                      <Badge tone="red">
                        Returned {i.rejectedQty}: {i.rejectReason}
                      </Badge>
                    )}
                    {i.rejectPhotoUrl && (
                      <a href={i.rejectPhotoUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs text-primary underline">
                        photo
                      </a>
                    )}
                  </div>
                  {packing ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">Packed</span>
                      <Input
                        type="number"
                        min={0}
                        max={i.qty}
                        className="w-20"
                        value={packing[i.id] ?? i.qty}
                        onChange={(e) => setPacking((p) => ({ ...p!, [i.id]: Math.min(i.qty, Math.max(0, Number(e.target.value))) }))}
                      />
                    </div>
                  ) : (
                    <div className="text-sm font-semibold">{formatINR(i.pricePaise * effectiveLineQty(i))}</div>
                  )}
                </div>
              ))}
            </div>
            {packing && (
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setPacking(null)}>
                  Cancel
                </Button>
                <Button loading={pack.isPending} onClick={() => pack.mutate()}>
                  Mark packed & generate bill
                </Button>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-base">Timeline</h2>
            <ol className="space-y-3 border-l-2 border-light-green pl-4">
              {o.events.map((e) => (
                <li key={e.id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  <span className="font-medium text-ink">{ORDER_STATUS_LABEL[e.status]}</span>
                  <span className="text-muted">
                    {' '}
                    · {new Date(e.createdAt).toLocaleString('en-IN')} {e.actorName && `· ${e.actorName}`}
                  </span>
                  {e.note && <div className="text-xs text-muted">{e.note}</div>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          {canOperate && !['DELIVERED', 'PARTIALLY_DELIVERED', 'CANCELLED'].includes(o.status) && (
            <Card className="space-y-2 p-5">
              <h2 className="mb-1 text-base">Actions</h2>
              {moves.map((s) => (
                <Button key={s} block variant={s === 'PACKED' ? 'outline' : 'primary'} loading={status.isPending} onClick={() => status.mutate(s)}>
                  {s === 'PACKED' ? 'Unassign rider' : `Mark ${ORDER_STATUS_LABEL[s].toLowerCase()}`}
                </Button>
              ))}
              {['PACKED', 'ASSIGNED'].includes(o.status) && (
                <Button block variant="secondary" onClick={() => setAssignOpen(true)}>
                  {o.riderId ? 'Reassign rider' : 'Assign rider'}
                </Button>
              )}
              <Button block variant="ghost" className="text-danger" onClick={() => setCancelOpen(true)}>
                Cancel order
              </Button>
            </Card>
          )}

          <Card className="p-5 text-sm">
            <h2 className="mb-2 text-base">Customer</h2>
            <div className="font-medium text-ink">{o.customerName ?? 'Walk-in'}</div>
            {o.customerPhone && (
              <a href={`tel:${o.customerPhone}`} className="flex items-center gap-1 text-primary">
                <Phone size={14} /> {o.customerPhone}
              </a>
            )}
            {o.address && (
              <p className="mt-2 flex gap-1 text-muted">
                <MapPin size={14} className="mt-0.5 shrink-0" />
                {o.address.line1}
                {o.address.landmark ? `, ${o.address.landmark}` : ''}, {o.address.city} – {o.address.pincode}
              </p>
            )}
            {o.note && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs">Note: {o.note}</p>}
            {o.riderName && <p className="mt-2">Rider: {o.riderName}</p>}
          </Card>

          <Card className="space-y-1.5 p-5 text-sm">
            <h2 className="mb-2 text-base">Bill</h2>
            <Row k="Items" v={formatINR(effSubtotal)} />
            {o.discountPaise > 0 && <Row k={`Coupon ${o.couponCode ?? ''}`} v={`– ${formatINR(Math.min(o.discountPaise, effSubtotal))}`} />}
            <Row k="Delivery" v={formatINR(effSubtotal ? o.deliveryFeePaise : 0)} />
            <div className="flex justify-between border-t border-line pt-2 font-semibold text-ink">
              <span>Payable</span>
              <span>{formatINR(o.finalPayablePaise)}</span>
            </div>
            <Row k="Payment" v={`${o.paymentMode} · ${o.paymentStatus.toLowerCase()}`} />
            {o.codCollectedPaise != null && <Row k="Cash collected" v={formatINR(o.codCollectedPaise)} />}
            {o.refunds.map((r) => (
              <Row key={r.id} k={`Refund (${r.source.toLowerCase()})`} v={`${formatINR(r.amountPaise)} · ${r.status.toLowerCase()}`} />
            ))}
          </Card>
        </div>
      </div>
      {cancelOpen && <CancelModal order={o} onClose={() => setCancelOpen(false)} onDone={update} />}
      {assignOpen && <AssignModal orderIds={[o.id]} date={o.slotDate ?? undefined} onClose={() => setAssignOpen(false)} onDone={() => qc.invalidateQueries({ queryKey: ['ops'] })} />}
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}

function CancelModal({ order, onClose, onDone }: { order: OrderDetail; onClose: () => void; onDone: (o: OrderDetail) => void }) {
  const [reason, setReason] = useState('Customer requested');
  const m = useMutation({
    mutationFn: () => api.ops.cancel(order.id, reason),
    onSuccess: (o) => {
      onDone(o);
      onClose();
      toast.success('Order cancelled, stock released');
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal open onClose={onClose} title={`Cancel #${order.orderNo}?`} footer={<Button variant="danger" loading={m.isPending} onClick={() => m.mutate()}>Cancel order</Button>}>
      <Field label="Reason (shared with the customer)">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {order.paymentStatus === 'PAID' && <p className="mt-3 text-sm text-muted">The paid amount will be refunded automatically.</p>}
    </Modal>
  );
}

export function AssignModal({ orderIds, date, onClose, onDone }: { orderIds: string[]; date?: string; onClose: () => void; onDone: () => void }) {
  const riders = useQuery({ queryKey: qk.riders(date), queryFn: () => api.ops.riders(date) });
  const [riderId, setRiderId] = useState('');
  const options = useMemo(() => riders.data ?? [], [riders.data]);
  useEffect(() => {
    if (!riderId && options[0]) setRiderId(options[0].id);
  }, [options, riderId]);
  const m = useMutation({
    mutationFn: () => api.ops.dispatch(orderIds, riderId),
    onSuccess: (r) => {
      toast.success(`${r.assigned} order(s) assigned`);
      onDone();
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal open onClose={onClose} title={`Assign ${orderIds.length} order(s)`} footer={<Button disabled={!riderId} loading={m.isPending} onClick={() => m.mutate()}>Assign</Button>}>
      {riders.isLoading ? (
        <PageLoader />
      ) : !options.length ? (
        <p className="text-sm text-muted">No active delivery partners. Add them on the Staff page.</p>
      ) : (
        <div className="space-y-2">
          {options.map((r) => (
            <label key={r.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 ${riderId === r.id ? 'border-primary bg-light-green/50' : 'border-line'}`}>
              <input type="radio" className="accent-primary" checked={riderId === r.id} onChange={() => setRiderId(r.id)} />
              <span className="flex-1">
                <span className="block font-medium text-ink">{r.name ?? r.phone}</span>
                <span className="text-xs text-muted">
                  {r.phone} · {r.assignedCount} active
                </span>
              </span>
              {r.isOnline ? <Badge tone="green">Online</Badge> : <Badge>Offline</Badge>}
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}
