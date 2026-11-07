import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, Printer, Search, Trash2, Truck } from 'lucide-react';
import { qk } from '@sabjiilelo/api-client';
import { formatDateLabel, formatINR, formatQty, todayIST, type Variant } from '@sabjiilelo/shared';
import { api, openBlob } from '../../lib/api';
import { canAutoFocus } from '../../lib/device';
import { Badge, Button, Card, EmptyState, Field, Input, MoneyInput, PageHeader, PageLoader, Select, Table, Tabs } from '../../components/ui';
import { ProduceImage } from '../../components/ProduceImage';
import { toast } from '../../components/toast';
import { AssignModal } from './Orders';

export function PickList() {
  const [date, setDate] = useState(todayIST());
  const [slotId, setSlotId] = useState('');
  const slots = useQuery({ queryKey: qk.manageSlots, queryFn: api.manage.slots });
  const q = useQuery({ queryKey: qk.picklist(date, slotId), queryFn: () => api.ops.picklist(date, slotId || undefined) });
  return (
    <>
      <PageHeader
        title="Pick list"
        subtitle="Total quantity to pick for orders not yet packed."
        actions={
          <Button variant="outline" icon={<Printer size={16} />} onClick={() => window.print()}>
            Print
          </Button>
        }
      />
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
        <Select className="w-40" value={slotId} onChange={(e) => setSlotId(e.target.value)}>
          <option value="">All slots</option>
          {slots.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      <h2 className="mb-2 hidden text-lg print:block">
        Pick list · {formatDateLabel(date)} {slots.data?.find((s) => s.id === slotId)?.label ?? ''}
      </h2>
      {q.isLoading ? (
        <PageLoader />
      ) : !q.data?.rows.length ? (
        <EmptyState title="Nothing to pick" text="All orders for this slot are packed, or none have come in yet." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Total to pick</th>
              <th>Pack breakdown</th>
              <th>Orders</th>
              <th className="print:table-cell hidden">✓</th>
            </tr>
          </thead>
          <tbody>
            {q.data.rows.map((r) => (
              <tr key={r.itemId}>
                <td className="font-medium text-ink">{r.name}</td>
                <td className="text-lg font-semibold text-primary">{formatQty(r.unitType, r.totalBaseQty)}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {r.variants.map((v) => (
                      <Badge key={v.label}>
                        {v.label} × {v.qty}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td>{r.orders}</td>
                <td className="hidden print:table-cell">☐</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

export function Dispatch() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayIST());
  const [slotId, setSlotId] = useState('');
  const [pincode, setPincode] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [assign, setAssign] = useState(false);
  const slots = useQuery({ queryKey: qk.manageSlots, queryFn: api.manage.slots });
  const filters = { date, slotId, status: 'PACKED', pageSize: 100 };
  const q = useQuery({ queryKey: qk.opsOrders(filters), queryFn: () => api.ops.orders(filters) });
  const riders = useQuery({ queryKey: qk.riders(date), queryFn: () => api.ops.riders(date) });
  const orders = (q.data?.data ?? []).filter((o) => !pincode || o.pincode === pincode);
  const pincodes = useMemo(() => [...new Set((q.data?.data ?? []).map((o) => o.pincode).filter(Boolean))] as string[], [q.data]);

  return (
    <>
      <PageHeader
        title="Dispatch"
        subtitle="Packed orders waiting for a delivery partner. Group by pincode and assign in one go."
        actions={
          <Button icon={<Truck size={16} />} disabled={!selected.length} onClick={() => setAssign(true)}>
            Assign {selected.length || ''} orders
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
            <Select className="w-36" value={slotId} onChange={(e) => setSlotId(e.target.value)}>
              <option value="">All slots</option>
              {slots.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Tabs value={pincode} onChange={setPincode} options={[{ value: '', label: 'All pincodes' }, ...pincodes.map((p) => ({ value: p, label: p }))]} />
          </div>
          {q.isLoading ? (
            <PageLoader />
          ) : !orders.length ? (
            <EmptyState icon="/icons/truck.webp" title="Nothing waiting" text="Packed orders show up here." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th className="w-8">
                    <input type="checkbox" className="accent-primary" checked={orders.every((o) => selected.includes(o.id))} onChange={(e) => setSelected(e.target.checked ? orders.map((o) => o.id) : [])} />
                  </th>
                  <th>Order</th>
                  <th>Pincode</th>
                  <th>Slot</th>
                  <th>Collect</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={selected.includes(o.id)}
                        onChange={(e) => setSelected((s) => (e.target.checked ? [...s, o.id] : s.filter((x) => x !== o.id)))}
                      />
                    </td>
                    <td>
                      <Link to={`/dashboard/orders/${o.id}`} className="font-semibold text-primary">
                        #{o.orderNo}
                      </Link>
                      <div className="text-xs text-muted">{o.customerName}</div>
                    </td>
                    <td>{o.pincode}</td>
                    <td>{o.slotLabel}</td>
                    <td>{o.paymentMode === 'COD' ? formatINR(o.finalPayablePaise) : <Badge tone="green">Prepaid</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
        <Card className="h-fit p-5">
          <h2 className="mb-3 text-base">Delivery partners</h2>
          <div className="space-y-2">
            {riders.data?.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span>
                  <span className={`mr-2 inline-block h-2 w-2 rounded-full ${r.isOnline ? 'bg-leaf' : 'bg-line'}`} />
                  {r.name ?? r.phone}
                </span>
                <Badge>{r.assignedCount} active</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {assign && (
        <AssignModal
          orderIds={selected}
          date={date}
          onClose={() => setAssign(false)}
          onDone={() => {
            setSelected([]);
            qc.invalidateQueries({ queryKey: ['ops'] });
          }}
        />
      )}
    </>
  );
}

type PosLine = { variant: Variant; name: string; image: string | null; qty: number };

export function Pos() {
  const items = useQuery({ queryKey: qk.items(), queryFn: () => api.manage.items() });
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<PosLine[]>([]);
  const [mode, setMode] = useState<'CASH' | 'UPI'>('CASH');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [discount, setDiscount] = useState(0);
  const [tendered, setTendered] = useState(0);

  const subtotal = lines.reduce((s, l) => s + l.variant.pricePaise * l.qty, 0);
  const total = Math.max(0, subtotal - discount);
  const list = (items.data ?? []).filter((i) => i.isActive && i.name.toLowerCase().includes(search.toLowerCase()));

  const add = (v: Variant, name: string, image: string | null) =>
    setLines((ls) => {
      const found = ls.find((l) => l.variant.id === v.id);
      return found ? ls.map((l) => (l.variant.id === v.id ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { variant: v, name, image, qty: 1 }];
    });
  const setQty = (id: string, qty: number) => setLines((ls) => ls.map((l) => (l.variant.id === id ? { ...l, qty } : l)).filter((l) => l.qty > 0));

  const sell = useMutation({
    mutationFn: () =>
      api.ops.pos({
        items: lines.map((l) => ({ variantId: l.variant.id, qty: l.qty })),
        paymentMode: mode,
        customerPhone: phone || undefined,
        customerName: name || undefined,
        discountPaise: discount,
      }),
    onSuccess: (o) => {
      toast.success(`Sale ${o.orderNo} recorded`);
      openBlob(api.invoices.download(o.id, 'bill'));
      setLines([]);
      setPhone('');
      setName('');
      setDiscount(0);
      setTendered(0);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <>
      <PageHeader title="Counter POS" subtitle="Bill walk-in customers. Stock is deducted from today's board." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="relative mb-4">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input autoFocus={canAutoFocus} placeholder="Search item" className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {items.isLoading ? (
            <PageLoader />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {list.map((i) => (
                <Card key={i.id} className="overflow-hidden">
                  <ProduceImage src={i.images[0]} name={i.name} className="h-20 w-full" emojiClass="text-4xl" />
                  <div className="p-2">
                    <div className="truncate text-sm font-semibold text-ink">{i.name}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {i.variants
                        .filter((v) => v.isActive)
                        .map((v) => (
                          <button key={v.id} onClick={() => add(v, i.name, i.images[0] ?? null)} className="rounded-lg bg-light-green px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary hover:text-white">
                            {v.label} · {formatINR(v.pricePaise)}
                          </button>
                        ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
        <Card className="sticky top-24 flex h-fit flex-col p-5">
          <h2 className="mb-3 text-base">Bill</h2>
          {!lines.length ? (
            <p className="py-8 text-center text-sm text-muted">Tap a pack size to add it</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {lines.map((l) => (
                <div key={l.variant.id} className="flex items-center gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{l.name}</div>
                    <div className="text-xs text-muted">
                      {l.variant.label} · {formatINR(l.variant.pricePaise)}
                    </div>
                  </div>
                  <button onClick={() => setQty(l.variant.id, l.qty - 1)} className="rounded-lg bg-beige p-1">
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center font-semibold">{l.qty}</span>
                  <button onClick={() => setQty(l.variant.id, l.qty + 1)} className="rounded-lg bg-beige p-1">
                    <Plus size={14} />
                  </button>
                  <span className="w-16 text-right font-semibold">{formatINR(l.variant.pricePaise * l.qty)}</span>
                  <button onClick={() => setQty(l.variant.id, 0)} className="text-muted hover:text-danger">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
            <Field label="Phone (optional)">
              <Input inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label="Name (optional)">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Discount">
              <MoneyInput value={discount} onChange={setDiscount} />
            </Field>
            <Field label="Payment">
              <Tabs value={mode} onChange={setMode} options={[{ value: 'CASH', label: 'Cash' }, { value: 'UPI', label: 'UPI' }]} />
            </Field>
            {mode === 'CASH' && (
              <Field label="Cash received">
                <MoneyInput value={tendered} onChange={setTendered} />
              </Field>
            )}
            {mode === 'CASH' && tendered > 0 && (
              <div className="flex flex-col justify-end pb-2 text-sm">
                <span className="text-muted">Return</span>
                <span className="text-lg font-semibold text-primary">{formatINR(Math.max(0, tendered - total))}</span>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between text-lg font-semibold text-ink">
            <span>Total</span>
            <span>{formatINR(total)}</span>
          </div>
          <Button size="lg" block className="mt-4" disabled={!lines.length} loading={sell.isPending} onClick={() => sell.mutate()}>
            Complete sale
          </Button>
        </Card>
      </div>
    </>
  );
}
