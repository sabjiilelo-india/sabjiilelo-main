import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, CheckCircle2, CreditCard, MapPin, Plus, Tag } from 'lucide-react';
import clsx from 'clsx';
import { qk } from '@sabjiilelo/api-client';
import { formatDateLabel, formatINR, formatTime12, type SlotOption } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { useShop } from '../../lib/shop';
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageLoader, Spinner } from '../../components/ui';
import { toast } from '../../components/toast';
import { createPortal } from 'react-dom';
import { AddressForm } from './AddressForm';
import { payWithRazorpay } from './payment';

export function useMockPayConfirm() {
  const [open, setOpen] = useState(false);
  const resolver = useRef<(ok: boolean) => void>(undefined);
  const confirm = () =>
    new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpen(true);
    });
  const close = (ok: boolean) => {
    setOpen(false);
    resolver.current?.(ok);
  };
  const modal = (
    <Modal
      open={open}
      onClose={() => close(false)}
      title="Test payment"
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button onClick={() => close(true)}>Pay successfully</Button>
        </>
      }
    >
      <p className="text-sm text-muted">Razorpay keys are not configured yet, so this simulates a successful UPI/card payment. Real checkout opens automatically once keys are added on the server.</p>
    </Modal>
  );
  return { confirm, modal };
}

export function CheckoutPage() {
  const { area } = useShop();
  const nav = useNavigate();
  const qc = useQueryClient();
  const addresses = useQuery({ queryKey: qk.addresses, queryFn: api.me.addresses });
  const coupons = useQuery({ queryKey: qk.coupons(area?.id ?? ''), queryFn: () => api.me.coupons(area!.id), enabled: !!area });
  const [addressId, setAddressId] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotOption | null>(null);
  const [mode, setMode] = useState<'RAZORPAY' | 'COD'>('COD');
  const [addOpen, setAddOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const mockPay = useMockPayConfirm();

  const usable = useMemo(() => (addresses.data ?? []).filter((a) => a.serviceable && a.areaId === area?.id), [addresses.data, area]);
  useEffect(() => {
    if (!addressId && usable.length) setAddressId((usable.find((a) => a.isDefault) ?? usable[0]!).id);
  }, [usable, addressId]);

  const quote = useQuery({
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    queryKey: qk.quote(addressId ?? '', coupon),
    queryFn: () => api.me.quote(addressId!, coupon),
    enabled: !!addressId,
  });
  useEffect(() => {
    if (quote.data && (!slot || !quote.data.slots.some((s) => s.slotId === slot.slotId && s.date === slot.date && s.available))) {
      setSlot(quote.data.slots.find((s) => s.available) ?? null);
    }
  }, [quote.data, slot]);
  useEffect(() => {
    if (quote.data?.coupon && !quote.data.coupon.valid) {
      toast.error(quote.data.coupon.message ?? 'Coupon not valid');
      setCoupon(null);
    }
  }, [quote.data?.coupon]);

  const slotsByDate = useMemo(() => {
    const m = new Map<string, SlotOption[]>();
    for (const s of quote.data?.slots ?? []) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return [...m];
  }, [quote.data]);

  async function place() {
    if (!addressId || !slot) return;
    setPlacing(true);
    try {
      const { order, razorpay } = await api.me.placeOrder({
        addressId,
        slotId: slot.slotId,
        slotDate: slot.date,
        couponCode: coupon,
        paymentMode: mode,
        channel: 'WEB',
      });
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['catalog'] });
      if (razorpay) {
        try {
          const paid = await payWithRazorpay(order.id, razorpay, mockPay.confirm);
          if (!paid) toast.info('Payment not completed. You can retry from your order within 15 minutes.');
        } catch (e) {
          toast.error((e as Error).message);
        }
      }
      nav(`/orders/${order.id}?placed=1`, { replace: true });
    } catch (e) {
      toast.error((e as Error).message);
      quote.refetch();
    } finally {
      setPlacing(false);
    }
  }

  if (addresses.isLoading) return <PageLoader />;
  const q = quote.data;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <h1 className="text-xl">Checkout</h1>

        {/* Address */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base">
              <MapPin size={18} className="text-accent" /> Delivery address
            </h2>
            <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
              Add new
            </Button>
          </div>
          {usable.length === 0 ? (
            <p className="text-sm text-muted">Add an address in {area?.name} to continue.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {usable.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAddressId(a.id)}
                  className={clsx('rounded-xl border-2 p-3 text-left text-sm transition', a.id === addressId ? 'border-primary bg-light-green/50' : 'border-line hover:border-primary/40')}
                >
                  <div className="flex items-center gap-2 font-semibold text-ink">
                    {a.label} {a.isDefault && <Badge tone="green">Default</Badge>}
                  </div>
                  <div className="mt-1 text-muted">
                    {a.name}, {a.line1}
                    {a.landmark ? `, ${a.landmark}` : ''}, {a.city} – {a.pincode}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Slot */}
        <Card className="p-5">
          <h2 className="mb-3 text-base">Delivery slot</h2>
          {quote.isLoading ? (
            <div className="skeleton h-20" />
          ) : slotsByDate.length === 0 ? (
            <p className="text-sm text-muted">No slots available right now.</p>
          ) : (
            <div className="space-y-3">
              {slotsByDate.map(([date, list]) => (
                <div key={date}>
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{formatDateLabel(date)}</div>
                  <div className="flex flex-wrap gap-2">
                    {list.map((s) => {
                      const selected = slot?.slotId === s.slotId && slot.date === s.date;
                      return (
                        <button
                          key={s.slotId + s.date}
                          disabled={!s.available}
                          onClick={() => setSlot(s)}
                          className={clsx(
                            'rounded-xl border-2 px-4 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40',
                            selected ? 'border-primary bg-light-green/60 text-primary' : 'border-line hover:border-primary/40',
                          )}
                        >
                          <div className="font-semibold">{s.label}</div>
                          <div className="text-xs">
                            {formatTime12(s.startTime)} – {formatTime12(s.endTime)}
                          </div>
                          {!s.available && <div className="text-[11px]">{s.remaining === 0 ? 'Full' : 'Closed'}</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Payment */}
        <Card className="p-5">
          <h2 className="mb-3 text-base">Payment</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { v: 'RAZORPAY' as const, title: 'Pay online', text: 'UPI, cards, netbanking', icon: <CreditCard size={20} /> },
              { v: 'COD' as const, title: 'Cash on delivery', text: 'Pay after checking at your door', icon: <Banknote size={20} /> },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => setMode(o.v)}
                className={clsx('flex items-center gap-3 rounded-xl border-2 p-3 text-left transition', mode === o.v ? 'border-primary bg-light-green/50' : 'border-line hover:border-primary/40')}
              >
                <span className="rounded-lg bg-white p-2 text-primary shadow-sm">{o.icon}</span>
                <span>
                  <span className="block text-sm font-semibold text-ink">{o.title}</span>
                  <span className="text-xs text-muted">{o.text}</span>
                </span>
                {mode === o.v && <CheckCircle2 className="ml-auto text-primary" size={20} />}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base">
            <Tag size={18} className="text-accent" /> Offers
          </h2>
          {coupon ? (
            <div className="flex items-center justify-between rounded-xl bg-light-green px-3 py-2 text-sm">
              <span className="font-semibold text-primary">{coupon} applied</span>
              <button className="text-xs text-danger" onClick={() => setCoupon(null)}>
                Remove
              </button>
            </div>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (couponInput.trim()) setCoupon(couponInput.trim().toUpperCase());
              }}
            >
              <Input placeholder="Coupon code" value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} />
              <Button type="submit" variant="outline">
                Apply
              </Button>
            </form>
          )}
          {!coupon && !!coupons.data?.length && (
            <div className="mt-3 space-y-2">
              {coupons.data.map((c) => (
                <button key={c.id} onClick={() => setCoupon(c.code)} className="w-full rounded-xl border border-dashed border-accent/60 bg-accent/5 px-3 py-2 text-left text-xs hover:bg-accent/10">
                  <span className="font-bold text-[#c25a14]">{c.code}</span> · {c.description}
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="sticky top-24 p-5">
          <h2 className="mb-3 text-base">Bill details</h2>
          {quote.error ? (
            <ErrorState error={quote.error} />
          ) : !q ? (
            <div className="skeleton h-32" />
          ) : q.lines.length === 0 ? (
            <EmptyState title="Cart is empty" action={<Link to="/"><Button size="sm">Shop now</Button></Link>} />
          ) : (
            <>
              <div className="space-y-2 text-sm">
                <Row label={`Items (${q.lines.reduce((s, l) => s + l.qty, 0)})`} value={formatINR(q.subtotalPaise)} />
                {q.discountPaise > 0 && <Row label="Coupon discount" value={`– ${formatINR(q.discountPaise)}`} green />}
                <Row label="Delivery fee" value={q.deliveryFeePaise ? formatINR(q.deliveryFeePaise) : 'FREE'} green={!q.deliveryFeePaise} />
                {q.amountToFreeDeliveryPaise > 0 && q.deliveryFeePaise > 0 && (
                  <p className="rounded-lg bg-mint px-2 py-1 text-xs text-primary">Add {formatINR(q.amountToFreeDeliveryPaise)} more for free delivery</p>
                )}
                <div className="flex justify-between border-t border-line pt-3 text-base font-semibold text-ink">
                  <span>To pay</span>
                  <span>{formatINR(q.totalPaise)}</span>
                </div>
              </div>
              {!q.meetsMinOrder && <p className="mt-3 text-sm text-danger">Minimum order is {formatINR(q.minOrderPaise)}.</p>}
              <Button
                size="lg"
                block
                className="mt-5"
                loading={placing}
                disabled={!slot || !q.meetsMinOrder || q.lines.some((l) => !l.available)}
                onClick={place}
              >
                {mode === 'COD' ? 'Place order' : `Pay ${formatINR(q.totalPaise)}`}
              </Button>
              {slot && (
                <p className="mt-2 text-center text-xs text-muted">
                  Arrives {formatDateLabel(slot.date).toLowerCase()}, {formatTime12(slot.startTime)}–{formatTime12(slot.endTime)}
                </p>
              )}
            </>
          )}
        </Card>
      </div>

      {addOpen && <AddressForm open onClose={() => setAddOpen(false)} onSaved={(a) => a.serviceable && a.areaId === area?.id && setAddressId(a.id)} />}
      {mockPay.modal}
      {placing &&
        createPortal(
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/55 p-6 backdrop-blur-[2px]">
            <div className="dialog-in flex w-full max-w-xs flex-col items-center rounded-3xl bg-white p-7 text-center shadow-lift">
              <img src="/icons/truck.webp" alt="" className="h-20 w-20 object-contain" />
              <Spinner className="mt-2" />
              <h2 className="mt-3 text-lg">Placing your order…</h2>
              <p className="mt-1 text-sm text-muted">This takes a few seconds. Please don't close this page.</p>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function Row({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className={green ? 'font-medium text-primary' : ''}>{value}</span>
    </div>
  );
}
