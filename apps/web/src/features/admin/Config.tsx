import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { qk } from '@sabjiilelo/api-client';
import { formatINR, formatTime12, todayIST, addDays, type Banner, type Coupon, type DeliverySlot } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { Badge, Button, Card, Field, Input, Modal, MoneyInput, PageHeader, PageLoader, Select, Table, Toggle } from '../../components/ui';
import { ImageUpload } from '../../components/ImageUpload';
import { toast } from '../../components/toast';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Slots() {
  const q = useQuery({ queryKey: qk.manageSlots, queryFn: api.manage.slots });
  const [editing, setEditing] = useState<DeliverySlot | 'new' | null>(null);
  if (q.isLoading) return <PageLoader />;
  return (
    <>
      <PageHeader
        title="Delivery slots"
        subtitle="Customers pick a slot at checkout. Orders close at the cutoff; capacity limits orders per slot per day."
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setEditing('new')}>
            New slot
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {q.data?.map((s) => (
          <Card key={s.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg">{s.label}</h3>
                <p className="text-sm text-muted">
                  {formatTime12(s.startTime)} – {formatTime12(s.endTime)}
                </p>
              </div>
              {s.isActive ? <Badge tone="green">Active</Badge> : <Badge>Off</Badge>}
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <div>
                Orders close <b>{Math.floor(s.cutoffMinutesBefore / 60)}h {s.cutoffMinutesBefore % 60 ? `${s.cutoffMinutesBefore % 60}m` : ''}</b> before start
              </div>
              <div>
                Capacity <b>{s.capacity}</b> orders/day
              </div>
              <div className="flex gap-1 pt-1">
                {DAYS.map((d, i) => (
                  <span key={d} className={`rounded px-1.5 py-0.5 text-[11px] ${s.daysOfWeek.includes(i) ? 'bg-light-green text-primary' : 'bg-beige text-muted line-through'}`}>
                    {d}
                  </span>
                ))}
              </div>
            </div>
            <Button size="sm" variant="outline" className="mt-4" onClick={() => setEditing(s)}>
              Edit
            </Button>
          </Card>
        ))}
      </div>
      {editing && <SlotForm slot={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function SlotForm({ slot, onClose }: { slot: DeliverySlot | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    label: slot?.label ?? '',
    startTime: slot?.startTime ?? '07:00',
    endTime: slot?.endTime ?? '10:00',
    cutoffMinutesBefore: slot?.cutoffMinutesBefore ?? 600,
    capacity: slot?.capacity ?? 100,
    daysOfWeek: slot?.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6],
    isActive: slot?.isActive ?? true,
    sort: slot?.sort ?? 0,
  });
  const m = useMutation({
    mutationFn: () => (slot ? api.manage.updateSlot(slot.id, f) : api.manage.createSlot(f)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.manageSlots });
      qc.invalidateQueries({ queryKey: ['catalog'] });
      toast.success('Slot saved');
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal open onClose={onClose} title={slot ? 'Edit slot' : 'New slot'} footer={<Button loading={m.isPending} onClick={() => m.mutate()}>Save</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <Input value={f.label} placeholder="Morning" onChange={(e) => setF({ ...f, label: e.target.value })} />
        </Field>
        <Field label="Starts">
          <Input type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} />
        </Field>
        <Field label="Ends">
          <Input type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} />
        </Field>
        <Field label="Cutoff (hours before start)">
          <Input type="number" min={0} step="0.5" value={f.cutoffMinutesBefore / 60} onChange={(e) => setF({ ...f, cutoffMinutesBefore: Math.round(Number(e.target.value) * 60) })} />
        </Field>
        <Field label="Max orders per day">
          <Input type="number" min={1} value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} />
        </Field>
        <Field label="Days" className="sm:col-span-2">
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => {
              const on = f.daysOfWeek.includes(i);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setF({ ...f, daysOfWeek: on ? f.daysOfWeek.filter((x) => x !== i) : [...f.daysOfWeek, i].sort() })}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${on ? 'border-primary bg-light-green text-primary' : 'border-line text-muted'}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </Field>
        <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Active" />
      </div>
    </Modal>
  );
}

export function Coupons() {
  const q = useQuery({ queryKey: qk.manageCoupons, queryFn: api.manage.coupons });
  const [editing, setEditing] = useState<Coupon | 'new' | null>(null);
  if (q.isLoading) return <PageLoader />;
  return (
    <>
      <PageHeader
        title="Coupons"
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setEditing('new')}>
            New coupon
          </Button>
        }
      />
      <Table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Offer</th>
            <th>Min order</th>
            <th>Valid</th>
            <th>Used</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {q.data?.map((c) => (
            <tr key={c.id}>
              <td className="font-mono font-semibold text-ink">{c.code}</td>
              <td>
                {c.type === 'FLAT' ? formatINR(c.value) + ' off' : `${c.value}% off${c.maxDiscountPaise ? ` up to ${formatINR(c.maxDiscountPaise)}` : ''}`}
                {c.description && <div className="text-xs text-muted">{c.description}</div>}
              </td>
              <td>{formatINR(c.minOrderPaise)}</td>
              <td className="text-xs">
                {c.validFrom} → {c.validTo}
              </td>
              <td>
                {c.usedCount}
                {c.usageLimit ? ` / ${c.usageLimit}` : ''}
              </td>
              <td>{c.isActive ? <Badge tone="green">Active</Badge> : <Badge>Off</Badge>}</td>
              <td className="text-right">
                <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                  Edit
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {editing && <CouponForm coupon={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function CouponForm({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    code: coupon?.code ?? '',
    description: coupon?.description ?? '',
    type: coupon?.type ?? ('FLAT' as 'FLAT' | 'PERCENT'),
    value: coupon?.value ?? 5000,
    maxDiscountPaise: coupon?.maxDiscountPaise ?? null,
    minOrderPaise: coupon?.minOrderPaise ?? 0,
    validFrom: coupon?.validFrom ?? todayIST(),
    validTo: coupon?.validTo ?? addDays(todayIST(), 30),
    usageLimit: coupon?.usageLimit ?? null,
    perUserLimit: coupon?.perUserLimit ?? 1,
    isActive: coupon?.isActive ?? true,
  });
  const m = useMutation({
    mutationFn: () => (coupon ? api.manage.updateCoupon(coupon.id, f) : api.manage.createCoupon(f)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.manageCoupons });
      toast.success('Coupon saved');
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal open onClose={onClose} title={coupon ? 'Edit coupon' : 'New coupon'} wide footer={<Button loading={m.isPending} onClick={() => m.mutate()}>Save</Button>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Code">
          <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Input value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label="Type">
          <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as 'FLAT' | 'PERCENT', value: e.target.value === 'FLAT' ? 5000 : 10 })}>
            <option value="FLAT">Flat ₹ off</option>
            <option value="PERCENT">Percent off</option>
          </Select>
        </Field>
        <Field label={f.type === 'FLAT' ? 'Amount off' : 'Percent off'}>
          {f.type === 'FLAT' ? (
            <MoneyInput value={f.value} onChange={(v) => setF({ ...f, value: v })} />
          ) : (
            <Input type="number" min={1} max={100} value={f.value} onChange={(e) => setF({ ...f, value: Number(e.target.value) })} />
          )}
        </Field>
        {f.type === 'PERCENT' ? (
          <Field label="Max discount">
            <MoneyInput value={f.maxDiscountPaise ?? 0} onChange={(v) => setF({ ...f, maxDiscountPaise: v || null })} />
          </Field>
        ) : (
          <div />
        )}
        <Field label="Minimum order">
          <MoneyInput value={f.minOrderPaise} onChange={(v) => setF({ ...f, minOrderPaise: v })} />
        </Field>
        <Field label="Valid from">
          <Input type="date" value={f.validFrom} onChange={(e) => setF({ ...f, validFrom: e.target.value })} />
        </Field>
        <Field label="Valid to">
          <Input type="date" value={f.validTo} onChange={(e) => setF({ ...f, validTo: e.target.value })} />
        </Field>
        <Field label="Total uses (blank = unlimited)">
          <Input type="number" min={1} value={f.usageLimit ?? ''} onChange={(e) => setF({ ...f, usageLimit: e.target.value ? Number(e.target.value) : null })} />
        </Field>
        <Field label="Uses per customer">
          <Input type="number" min={1} value={f.perUserLimit} onChange={(e) => setF({ ...f, perUserLimit: Number(e.target.value) })} />
        </Field>
        <div className="flex items-end pb-2">
          <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Active" />
        </div>
      </div>
    </Modal>
  );
}

export function Banners() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.banners, queryFn: api.manage.banners });
  const [editing, setEditing] = useState<Banner | 'new' | null>(null);
  const del = useMutation({ mutationFn: (id: string) => api.manage.deleteBanner(id), onSuccess: () => qc.invalidateQueries({ queryKey: qk.banners }) });
  if (q.isLoading) return <PageLoader />;
  return (
    <>
      <PageHeader
        title="Home banners"
        subtitle="Rotating banners at the top of the shop home page."
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setEditing('new')}>
            New banner
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {q.data?.map((b) => (
          <Card key={b.id} className="overflow-hidden">
            <img src={b.imageUrl} alt="" className="h-40 w-full object-cover" />
            <div className="flex items-start justify-between gap-2 p-4">
              <div>
                <div className="font-semibold text-ink">{b.title}</div>
                <div className="text-sm text-muted">{b.subtitle}</div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setEditing(b)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => window.confirm('Delete banner?') && del.mutate(b.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {editing && <BannerForm banner={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function BannerForm({ banner, onClose }: { banner: Banner | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: banner?.title ?? '', subtitle: banner?.subtitle ?? '', imageUrl: banner?.imageUrl ?? '', sort: banner?.sort ?? 0, isActive: banner?.isActive ?? true });
  const m = useMutation({
    mutationFn: () => (banner ? api.manage.updateBanner(banner.id, f) : api.manage.createBanner(f)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.banners });
      qc.invalidateQueries({ queryKey: ['catalog'] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal open onClose={onClose} title={banner ? 'Edit banner' : 'New banner'} footer={<Button disabled={!f.imageUrl} loading={m.isPending} onClick={() => m.mutate()}>Save</Button>}>
      <div className="space-y-4">
        <Field label="Image">
          <ImageUpload folder="banners" value={f.imageUrl ? [f.imageUrl] : []} onChange={(u) => setF({ ...f, imageUrl: u[0] ?? '' })} />
        </Field>
        <Field label="Title">
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="Subtitle">
          <Input value={f.subtitle ?? ''} onChange={(e) => setF({ ...f, subtitle: e.target.value })} />
        </Field>
        <Field label="Order">
          <Input type="number" value={f.sort} onChange={(e) => setF({ ...f, sort: Number(e.target.value) })} />
        </Field>
        <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Show on home page" />
      </div>
    </Modal>
  );
}

export function AreaSettings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.area, queryFn: api.area.get });
  const [f, setF] = useState({ minOrderPaise: 0, deliveryFeePaise: 0, freeDeliveryAbovePaise: 0, autoRefundLimitPaise: 0, demandBufferPct: 10 });
  useEffect(() => {
    if (q.data) {
      const { minOrderPaise, deliveryFeePaise, freeDeliveryAbovePaise, autoRefundLimitPaise, demandBufferPct } = q.data;
      setF({ minOrderPaise, deliveryFeePaise, freeDeliveryAbovePaise, autoRefundLimitPaise, demandBufferPct });
    }
  }, [q.data]);
  const m = useMutation({
    mutationFn: () => api.area.updateSettings(f),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.area });
      toast.success('Settings saved');
    },
    onError: (e) => toast.error((e as Error).message),
  });
  if (!q.data) return <PageLoader />;
  return (
    <>
      <PageHeader title="Area settings" subtitle={`${q.data.name} · ${q.data.pincodes.length} pincodes (pincodes are managed by the super admin)`} />
      <Card className="grid max-w-3xl gap-5 p-6 sm:grid-cols-2">
        <Field label="Minimum order value">
          <MoneyInput value={f.minOrderPaise} onChange={(v) => setF({ ...f, minOrderPaise: v })} />
        </Field>
        <Field label="Delivery fee">
          <MoneyInput value={f.deliveryFeePaise} onChange={(v) => setF({ ...f, deliveryFeePaise: v })} />
        </Field>
        <Field label="Free delivery above">
          <MoneyInput value={f.freeDeliveryAbovePaise} onChange={(v) => setF({ ...f, freeDeliveryAbovePaise: v })} />
        </Field>
        <Field label="Instant doorstep refund limit" hint="Doorstep returns up to this amount are refunded instantly; above it the accountant approves.">
          <MoneyInput value={f.autoRefundLimitPaise} onChange={(v) => setF({ ...f, autoRefundLimitPaise: v })} />
        </Field>
        <Field label="Purchase buffer %" hint="Extra stock to buy above confirmed orders on the demand screen.">
          <Input type="number" min={0} max={100} value={f.demandBufferPct} onChange={(e) => setF({ ...f, demandBufferPct: Number(e.target.value) })} />
        </Field>
        <div className="flex items-end sm:col-span-2">
          <Button loading={m.isPending} onClick={() => m.mutate()}>
            Save settings
          </Button>
        </div>
        <div className="sm:col-span-2">
          <span className="label">Pincodes</span>
          <div className="flex flex-wrap gap-1">
            {q.data.pincodes.map((p) => (
              <Badge key={p}>{p}</Badge>
            ))}
          </div>
        </div>
      </Card>
    </>
  );
}
