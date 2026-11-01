import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Download, PartyPopper, RefreshCw, Star } from 'lucide-react';
import clsx from 'clsx';
import { qk } from '@sabjiilelo/api-client';
import {
  ISSUE_TYPE_LABEL,
  ORDER_STATUS_LABEL,
  TRACKING_STEPS,
  effectiveLineQty,
  formatDateLabel,
  formatINR,
  formatTime12,
  trackingStepIndex,
  type IssueType,
  type OrderDetail,
} from '@sabjiilelo/shared';
import { api, openBlob } from '../../lib/api';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Modal, PageLoader, Pager, Select, StatusBadge, Textarea } from '../../components/ui';
import { ImageUpload } from '../../components/ImageUpload';
import { ProduceImage } from '../../components/ProduceImage';
import { toast } from '../../components/toast';
import { payWithRazorpay } from './payment';
import { useMockPayConfirm } from './Checkout';

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: [...qk.myOrders, page], queryFn: () => api.me.orders(page) });
  if (q.isLoading) return <PageLoader />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data?.data.length) return <EmptyState icon="/icons/truck.webp" title="No orders yet" text="Your fresh orders will show up here." action={<Link to="/"><Button>Start shopping</Button></Link>} />;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-xl">My orders</h1>
      <div className="space-y-3">
        {q.data.data.map((o) => (
          <Link key={o.id} to={`/orders/${o.id}`} className="card flex items-center gap-4 p-4 transition hover:border-primary/40">
            <div className="flex -space-x-3">
              {o.previewImages.length ? (
                o.previewImages.slice(0, 3).map((src) => <img key={src} src={src} alt="" className="h-12 w-12 rounded-xl border-2 border-white object-cover" />)
              ) : (
                <img src="/icons/basket.webp" alt="" className="h-12 w-12 object-contain" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">#{o.orderNo}</span>
                <StatusBadge status={o.status} />
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {o.itemCount} items · {o.slotDate ? `${formatDateLabel(o.slotDate)} ${o.slotLabel ?? ''}` : ''} · {o.paymentMode === 'COD' ? 'Cash' : 'Online'}
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{formatINR(o.finalPayablePaise)}</div>
              <ChevronRight size={18} className="ml-auto text-muted" />
            </div>
          </Link>
        ))}
      </div>
      <Pager page={page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />
    </div>
  );
}

function Timeline({ order }: { order: OrderDetail }) {
  if (order.status === 'CANCELLED') {
    return <div className="rounded-xl bg-danger/10 p-4 text-sm text-danger">This order was cancelled{order.cancelReason ? `: ${order.cancelReason}` : ''}.</div>;
  }
  const idx = trackingStepIndex(order.status);
  return (
    <ol className="flex items-start justify-between">
      {TRACKING_STEPS.map((s, i) => {
        const done = i <= idx;
        return (
          <li key={s} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && <span className={clsx('absolute right-1/2 top-3.5 h-0.5 w-full', i <= idx ? 'bg-primary' : 'bg-line')} />}
            <span className={clsx('relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2', done ? 'border-primary bg-primary text-white' : 'border-line bg-white')}>
              {done && <Check size={14} />}
            </span>
            <span className={clsx('mt-1.5 text-[11px] font-medium sm:text-xs', done ? 'text-primary' : 'text-muted')}>{ORDER_STATUS_LABEL[s]}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({
    queryKey: qk.myOrder(id!),
    queryFn: () => api.me.order(id!),
    refetchInterval: (query) => (query.state.data && ['DELIVERED', 'PARTIALLY_DELIVERED', 'CANCELLED'].includes(query.state.data.status) ? false : 30_000),
  });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const mockPay = useMockPayConfirm();

  const refresh = (o: OrderDetail) => qc.setQueryData(qk.myOrder(o.id), o);
  const rate = useMutation({ mutationFn: (s: number) => api.me.rate(id!, s), onSuccess: (o) => (refresh(o), toast.success('Thanks for the rating!')) });
  const reorder = useMutation({
    mutationFn: () => api.me.reorder(id!),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['me', 'cart'] });
      toast.success(`${r.added} items added to cart`);
      nav('/cart');
    },
  });

  if (q.isLoading) return <PageLoader />;
  if (q.error || !q.data) return <ErrorState error={q.error} />;
  const o = q.data;
  const effSubtotal = o.items.reduce((s, i) => s + i.pricePaise * effectiveLineQty(i), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {params.get('placed') && o.status !== 'PAYMENT_PENDING' && (
        <div className="flex items-center gap-3 rounded-2xl bg-primary p-4 text-white">
          <PartyPopper size={28} />
          <div>
            <div className="font-semibold">Order placed!</div>
            <div className="text-sm text-white/85">We'll pick it fresh and deliver in your slot.</div>
          </div>
        </div>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl">Order #{o.orderNo}</h1>
            <p className="text-sm text-muted">
              {o.slotDate && o.slot ? `${formatDateLabel(o.slotDate)}, ${o.slot.label} ${formatTime12(o.slot.startTime)}–${formatTime12(o.slot.endTime)}` : ''}
            </p>
          </div>
          <StatusBadge status={o.status} />
        </div>
        <div className="mt-6">
          <Timeline order={o} />
        </div>
        {o.riderName && ['ASSIGNED', 'OUT_FOR_DELIVERY'].includes(o.status) && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-mint px-3 py-2 text-sm">
            <img src="/icons/truck.webp" alt="" className="h-8 w-8 object-contain" /> {o.riderName} will deliver your order.
          </p>
        )}
        {o.status === 'PAYMENT_PENDING' && o.razorpay && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-sm">
            <span>Payment pending. Complete it within 15 minutes to confirm your order.</span>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  const paid = await payWithRazorpay(o.id, o.razorpay!, mockPay.confirm);
                  if (paid) refresh(paid);
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Pay {formatINR(o.totalPaise)}
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-base">Items</h2>
        <div className="divide-y divide-line/70">
          {o.items.map((i) => {
            const eff = effectiveLineQty(i);
            return (
              <div key={i.id} className="flex items-center gap-3 py-3">
                <ProduceImage src={i.image} name={i.name} className="h-12 w-12 shrink-0 rounded-xl" emojiClass="text-2xl" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink">{i.name}</div>
                  <div className="text-xs text-muted">
                    {i.variantLabel} × {i.qty}
                  </div>
                  {i.packedQty != null && i.packedQty < i.qty && <Badge tone="orange">{i.qty - i.packedQty} unavailable</Badge>}
                  {i.rejectedQty > 0 && (
                    <Badge tone="red">
                      {i.rejectedQty} returned · {i.rejectReason}
                    </Badge>
                  )}
                </div>
                <div className="text-right text-sm font-semibold">
                  {formatINR(i.pricePaise * eff)}
                  {eff !== i.qty && <div className="text-xs font-normal text-muted line-through">{formatINR(i.pricePaise * i.qty)}</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
          <Line label="Item total" value={formatINR(effSubtotal)} />
          {o.discountPaise > 0 && <Line label={`Coupon ${o.couponCode ?? ''}`} value={`– ${formatINR(Math.min(o.discountPaise, effSubtotal))}`} />}
          <Line label="Delivery fee" value={o.deliveryFeePaise && effSubtotal ? formatINR(o.deliveryFeePaise) : 'FREE'} />
          <div className="flex justify-between pt-1 text-base font-semibold text-ink">
            <span>{o.paymentMode === 'COD' ? (o.codCollectedPaise != null ? 'Paid in cash' : 'To pay on delivery') : 'Paid online'}</span>
            <span>{formatINR(o.codCollectedPaise ?? o.finalPayablePaise)}</span>
          </div>
        </div>
      </Card>

      {o.refunds.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 text-base">Refunds</h2>
          {o.refunds.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-1.5 text-sm">
              <span>
                {r.reason}
                <span className="block text-xs text-muted">{new Date(r.createdAt).toLocaleString('en-IN')}</span>
              </span>
              <span className="text-right">
                <span className="block font-semibold">{formatINR(r.amountPaise)}</span>
                <Badge tone={r.status === 'PROCESSED' ? 'green' : r.status === 'REJECTED' ? 'red' : 'yellow'}>{r.status.toLowerCase()}</Badge>
              </span>
            </div>
          ))}
        </Card>
      )}

      {o.canRate && (
        <Card className="p-5 text-center">
          <h2 className="text-base">How fresh was everything?</h2>
          <div className="mt-3 flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onMouseEnter={() => setStars(s)} onMouseLeave={() => setStars(0)} onClick={() => rate.mutate(s)} aria-label={`${s} stars`}>
                <Star size={32} className={s <= stars ? 'fill-accent text-accent' : 'text-line'} />
              </button>
            ))}
          </div>
        </Card>
      )}
      {o.rating && (
        <p className="text-center text-sm text-muted">
          You rated this order {'★'.repeat(o.rating.stars)}
          {'☆'.repeat(5 - o.rating.stars)}
        </p>
      )}

      {o.issues.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-2 text-base">Reported issues</h2>
          {o.issues.map((i) => (
            <div key={i.id} className="flex justify-between py-1 text-sm">
              <span>
                {ISSUE_TYPE_LABEL[i.type]}
                {i.itemName ? ` · ${i.itemName}` : ''}
              </span>
              <Badge tone={i.status === 'APPROVED' ? 'green' : i.status === 'REJECTED' ? 'red' : 'yellow'}>{i.status.toLowerCase()}</Badge>
            </div>
          ))}
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {o.invoiceNo && (
          <Button variant="outline" icon={<Download size={16} />} onClick={() => openBlob(api.invoices.download(o.id), `${o.orderNo}.pdf`)}>
            Download bill
          </Button>
        )}
        {['DELIVERED', 'PARTIALLY_DELIVERED', 'CANCELLED'].includes(o.status) && (
          <Button variant="secondary" icon={<RefreshCw size={16} />} loading={reorder.isPending} onClick={() => reorder.mutate()}>
            Order again
          </Button>
        )}
        {o.canReportIssue && (
          <Button variant="outline" onClick={() => setIssueOpen(true)}>
            Report an issue
          </Button>
        )}
        {o.canCancel && (
          <Button variant="ghost" className="text-danger" onClick={() => setCancelOpen(true)}>
            Cancel order
          </Button>
        )}
      </div>

      <CancelModal open={cancelOpen} onClose={() => setCancelOpen(false)} order={o} onDone={refresh} />
      {issueOpen && <IssueModal onClose={() => setIssueOpen(false)} order={o} onDone={refresh} />}
      {mockPay.modal}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}

const CANCEL_REASONS = ['Ordered by mistake', 'Need to change items', 'Will not be home', 'Found a better price', 'Other'];

function CancelModal({ open, onClose, order, onDone }: { open: boolean; onClose: () => void; order: OrderDetail; onDone: (o: OrderDetail) => void }) {
  const [reason, setReason] = useState(CANCEL_REASONS[0]!);
  const m = useMutation({
    mutationFn: () => api.me.cancel(order.id, reason),
    onSuccess: (o) => {
      onDone(o);
      onClose();
      toast.success(order.paymentStatus === 'PAID' ? 'Cancelled. Your refund has been started.' : 'Order cancelled');
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cancel this order?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep order
          </Button>
          <Button variant="danger" loading={m.isPending} onClick={() => m.mutate()}>
            Cancel order
          </Button>
        </>
      }
    >
      <Field label="Reason">
        <Select value={reason} onChange={(e) => setReason(e.target.value)}>
          {CANCEL_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </Field>
      {order.paymentStatus === 'PAID' && <p className="mt-3 text-sm text-muted">The full amount goes back to your original payment method.</p>}
    </Modal>
  );
}

function IssueModal({ onClose, order, onDone }: { onClose: () => void; order: OrderDetail; onDone: (o: OrderDetail) => void }) {
  const [orderItemId, setItem] = useState(order.items[0]?.id ?? '');
  const [type, setType] = useState<IssueType>('QUALITY');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const m = useMutation({
    mutationFn: () => api.me.reportIssue(order.id, { orderItemId: orderItemId || undefined, type, description: description || undefined, photoUrl: photos[0] }),
    onSuccess: (o) => {
      onDone(o);
      onClose();
      toast.success("Thanks — we'll review it within a day.");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="Report an issue"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button loading={m.isPending} onClick={() => m.mutate()}>
            Submit
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Item">
          <Select value={orderItemId} onChange={(e) => setItem(e.target.value)}>
            {order.items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} · {i.variantLabel}
              </option>
            ))}
            <option value="">Whole order</option>
          </Select>
        </Field>
        <Field label="What went wrong?">
          <Select value={type} onChange={(e) => setType(e.target.value as IssueType)}>
            {Object.entries(ISSUE_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Details (optional)">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Photo (optional)">
          <ImageUpload folder="issues" value={photos} onChange={setPhotos} />
        </Field>
      </div>
    </Modal>
  );
}
