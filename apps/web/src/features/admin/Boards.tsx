import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Save, Trash } from 'lucide-react';
import { qk } from '@sabjiilelo/api-client';
import { addDays, formatDateLabel, formatINR, formatQty, fromBaseQty, rateUnitLabel, toBaseQty, todayIST, type UnitType } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { Badge, Button, Field, Input, Modal, PageHeader, PageLoader, Table, Tabs } from '../../components/ui';
import { toast } from '../../components/toast';

/** Daily sellable stock per item. Quantities are typed in kg / L / pieces and stored in base units. */
export function StockBoard() {
  const qc = useQueryClient();
  const [date, setDate] = useState(addDays(todayIST(), 1));
  const q = useQuery({ queryKey: qk.stock(date), queryFn: () => api.manage.stock(date) });
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('');
  const [waste, setWaste] = useState<{ itemId: string; name: string; unitType: UnitType } | null>(null);
  useEffect(() => setEdits({}), [date]);

  const rows = useMemo(() => (q.data?.rows ?? []).filter((r) => r.name.toLowerCase().includes(filter.toLowerCase())), [q.data, filter]);
  const save = useMutation({
    mutationFn: () =>
      api.manage.saveStock({
        date,
        rows: Object.entries(edits).map(([itemId, v]) => {
          const r = q.data!.rows.find((x) => x.itemId === itemId)!;
          return { itemId, availableQty: toBaseQty(r.unitType, Number(v || 0)) };
        }),
      }),
    onSuccess: () => {
      toast.success('Stock saved');
      setEdits({});
      qc.invalidateQueries({ queryKey: ['manage', 'stock'] });
      qc.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const copy = useMutation({
    mutationFn: () => api.manage.copyStock(addDays(date, -1), date),
    onSuccess: (r) => {
      toast.success(`Copied ${r.copied} items from the previous day`);
      qc.invalidateQueries({ queryKey: qk.stock(date) });
    },
  });

  return (
    <>
      <PageHeader
        title="Daily stock"
        subtitle="How much of each item customers can buy for a delivery date. Orders reserve stock; at zero the item shows Sold out."
        actions={
          <>
            <Tabs
              value={date === todayIST() ? 't' : date === addDays(todayIST(), 1) ? 'tm' : 'x'}
              onChange={(v) => setDate(v === 't' ? todayIST() : addDays(todayIST(), 1))}
              options={[
                { value: 't', label: 'Today' },
                { value: 'tm', label: 'Tomorrow' },
              ]}
            />
            <Input type="date" className="w-40" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input placeholder="Filter items" className="max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <Button variant="outline" icon={<Copy size={16} />} loading={copy.isPending} onClick={() => copy.mutate()}>
          Copy from {formatDateLabel(addDays(date, -1)).toLowerCase()}
        </Button>
        <Button className="ml-auto" icon={<Save size={16} />} disabled={!Object.keys(edits).length} loading={save.isPending} onClick={() => save.mutate()}>
          Save {Object.keys(edits).length || ''} changes
        </Button>
      </div>
      {q.isLoading ? (
        <PageLoader />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Sellable</th>
              <th>Booked</th>
              <th>Left</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const v = edits[r.itemId] ?? (r.hasRow ? String(fromBaseQty(r.unitType, r.availableQty)) : '');
              return (
                <tr key={r.itemId} className={edits[r.itemId] !== undefined ? 'bg-light-green/40' : ''}>
                  <td className="font-medium text-ink">{r.name}</td>
                  <td className="text-muted">{r.categoryName}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        className="w-28"
                        placeholder="0"
                        value={v}
                        onChange={(e) => setEdits((s) => ({ ...s, [r.itemId]: e.target.value }))}
                      />
                      <span className="text-xs text-muted">{rateUnitLabel(r.unitType)}</span>
                    </div>
                  </td>
                  <td>{formatQty(r.unitType, r.reservedQty)}</td>
                  <td>{!r.hasRow ? <Badge>Not set</Badge> : r.remainingQty <= 0 ? <Badge tone="red">Sold out</Badge> : formatQty(r.unitType, r.remainingQty)}</td>
                  <td className="text-right">
                    <Button size="sm" variant="ghost" icon={<Trash size={14} />} onClick={() => setWaste(r)}>
                      Wastage
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {waste && <WastageModal item={waste} date={date} onClose={() => setWaste(null)} />}
    </>
  );
}

function WastageModal({ item, date, onClose }: { item: { itemId: string; name: string; unitType: UnitType }; date: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const m = useMutation({
    mutationFn: () => api.manage.wastage({ itemId: item.itemId, qty: toBaseQty(item.unitType, Number(qty)), note }, date),
    onSuccess: () => {
      toast.success('Wastage recorded');
      qc.invalidateQueries({ queryKey: qk.stock(date) });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Record wastage · ${item.name}`}
      footer={
        <Button variant="danger" disabled={!Number(qty)} loading={m.isPending} onClick={() => m.mutate()}>
          Record
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label={`Quantity (${rateUnitLabel(item.unitType)})`}>
          <Input type="number" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="Reason">
          <Input value={note} placeholder="Rotten, damaged in transit…" onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/** Morning price update across all pack sizes. */
export function PriceBoard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.items(), queryFn: () => api.manage.items() });
  const [edits, setEdits] = useState<Record<string, { pricePaise: number; mrpPaise: number; isActive: boolean }>>({});
  const [filter, setFilter] = useState('');
  const save = useMutation({
    mutationFn: () => api.manage.savePrices({ rows: Object.entries(edits).map(([variantId, v]) => ({ variantId, ...v })) }),
    onSuccess: (r) => {
      toast.success(`${r.updated} prices updated`);
      setEdits({});
      qc.invalidateQueries({ queryKey: ['manage', 'items'] });
      qc.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  if (q.isLoading) return <PageLoader />;
  const items = (q.data ?? []).filter((i) => i.isActive && i.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <PageHeader
        title="Price board"
        subtitle="Update today's selling price and MRP for every pack size."
        actions={
          <Button icon={<Save size={16} />} disabled={!Object.keys(edits).length} loading={save.isPending} onClick={() => save.mutate()}>
            Save {Object.keys(edits).length || ''} changes
          </Button>
        }
      />
      <Input placeholder="Filter items" className="mb-4 max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <Table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Pack</th>
            <th>Selling price (₹)</th>
            <th>MRP (₹)</th>
            <th>Per {`unit`}</th>
            <th>On sale</th>
          </tr>
        </thead>
        <tbody>
          {items.flatMap((i) =>
            i.variants.map((v, idx) => {
              const e = edits[v.id] ?? { pricePaise: v.pricePaise, mrpPaise: v.mrpPaise, isActive: v.isActive };
              const set = (patch: Partial<typeof e>) => setEdits((s) => ({ ...s, [v.id]: { ...e, ...patch } }));
              const perUnit = Math.round((e.pricePaise * (['KG', 'GRAM', 'LITRE'].includes(i.unitType) ? 1000 : 1)) / v.baseQty);
              return (
                <tr key={v.id} className={edits[v.id] ? 'bg-light-green/40' : ''}>
                  <td className="font-medium text-ink">{idx === 0 ? i.name : ''}</td>
                  <td>{v.label}</td>
                  <td>
                    <Input type="number" min={0} step="0.5" className="w-24" value={e.pricePaise / 100} onChange={(ev) => set({ pricePaise: Math.round(Number(ev.target.value) * 100) })} />
                  </td>
                  <td>
                    <Input type="number" min={0} step="0.5" className="w-24" value={e.mrpPaise / 100} onChange={(ev) => set({ mrpPaise: Math.round(Number(ev.target.value) * 100) })} />
                  </td>
                  <td className="text-muted">
                    {formatINR(perUnit)}/{rateUnitLabel(i.unitType)}
                  </td>
                  <td>
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={e.isActive} onChange={(ev) => set({ isActive: ev.target.checked })} />
                  </td>
                </tr>
              );
            }),
          )}
        </tbody>
      </Table>
    </>
  );
}
