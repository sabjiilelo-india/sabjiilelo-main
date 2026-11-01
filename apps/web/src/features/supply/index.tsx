import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, PackageCheck, Plus, Trash2 } from 'lucide-react';
import { qk } from '@sabjiilelo/api-client';
import {
  addDays,
  costPaise,
  formatDateLabel,
  formatINR,
  formatQty,
  fromBaseQty,
  rateUnitLabel,
  toBaseQty,
  todayIST,
  type DemandRow,
  type PoStatus,
  type UnitType,
} from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, MoneyInput, PageHeader, PageLoader, Select, Table, Tabs, Toggle } from '../../components/ui';
import { toast } from '../../components/toast';

export default function Supply({ page }: { page: 'demand' | 'pos' | 'po' }) {
  if (page === 'demand') return <Demand />;
  if (page === 'pos') return <PoList />;
  return <PoDetail />;
}

const PO_TONE: Record<PoStatus, 'blue' | 'green' | 'orange' | 'red' | 'gray'> = {
  SENT: 'blue',
  ACCEPTED: 'green',
  ADJUSTED: 'orange',
  REJECTED: 'red',
  RECEIVED: 'green',
  CLOSED: 'gray',
};
export const PoBadge = ({ status }: { status: PoStatus }) => <Badge tone={PO_TONE[status]}>{status.toLowerCase()}</Badge>;

type Draft = { itemId: string; name: string; unitType: UnitType; qty: string; ratePaise: number };

function Demand() {
  const [date, setDate] = useState(addDays(todayIST(), 1));
  const q = useQuery({ queryKey: qk.demand(date), queryFn: () => api.supply.demand(date) });
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<{ vendorId: string; rows: Draft[] } | null>(null);
  const rows = q.data?.rows ?? [];

  function openPo() {
    const chosen = rows.filter((r) => selected.includes(r.itemId));
    // Default to the vendor that is cheapest for most of the selected items.
    const tally = new Map<string, number>();
    chosen.forEach((r) => r.bestRate && tally.set(r.bestRate.vendorId, (tally.get(r.bestRate.vendorId) ?? 0) + 1));
    const vendorId = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    setDraft({
      vendorId,
      rows: chosen.map((r) => ({
        itemId: r.itemId,
        name: r.name,
        unitType: r.unitType,
        qty: String(fromBaseQty(r.unitType, Math.max(0, r.requiredBaseQty - r.alreadyPoBaseQty))),
        ratePaise: r.rates.find((x) => x.vendorId === vendorId)?.ratePaise ?? r.bestRate?.ratePaise ?? 0,
      })),
    });
  }

  return (
    <>
      <PageHeader
        title="Demand"
        subtitle={`What to buy for delivery ${formatDateLabel(date).toLowerCase()}: confirmed orders + ${q.data?.bufferPct ?? 0}% buffer, with the best vendor rates.`}
        actions={
          <>
            <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
            <Button icon={<Plus size={16} />} disabled={!selected.length} onClick={openPo}>
              Create PO ({selected.length})
            </Button>
          </>
        }
      />
      {q.isLoading ? (
        <PageLoader />
      ) : (
        <Table>
          <thead>
            <tr>
              <th className="w-8">
                <input type="checkbox" className="accent-primary" checked={!!rows.length && selected.length === rows.length} onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.itemId) : [])} />
              </th>
              <th>Item</th>
              <th>Ordered</th>
              <th>+ Buffer</th>
              <th>To buy</th>
              <th>On POs</th>
              <th>Best rate</th>
              <th>Other quotes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const gap = r.requiredBaseQty - r.alreadyPoBaseQty;
              return (
                <tr key={r.itemId} className={r.requiredBaseQty === 0 ? 'opacity-50' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={selected.includes(r.itemId)}
                      onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.itemId] : s.filter((x) => x !== r.itemId)))}
                    />
                  </td>
                  <td className="font-medium text-ink">{r.name}</td>
                  <td>{formatQty(r.unitType, r.orderedBaseQty)}</td>
                  <td className="text-muted">{formatQty(r.unitType, r.bufferBaseQty)}</td>
                  <td className="font-semibold text-primary">{formatQty(r.unitType, r.requiredBaseQty)}</td>
                  <td>{r.alreadyPoBaseQty ? <Badge tone={gap <= 0 ? 'green' : 'orange'}>{formatQty(r.unitType, r.alreadyPoBaseQty)}</Badge> : '—'}</td>
                  <td>
                    {r.bestRate ? (
                      <>
                        {formatINR(r.bestRate.ratePaise)}/{rateUnitLabel(r.unitType)}
                        <div className="text-xs text-muted">{r.bestRate.vendorName}</div>
                      </>
                    ) : (
                      <span className="text-muted">No quotes</span>
                    )}
                  </td>
                  <td className="text-xs text-muted">
                    {r.rates.slice(1, 3).map((x) => (
                      <div key={x.vendorId}>
                        {x.vendorName}: {formatINR(x.ratePaise)}
                      </div>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {draft && <PoDraftModal date={date} draft={draft} rows={rows} onClose={() => setDraft(null)} />}
    </>
  );
}

function PoDraftModal({ date, draft, rows, onClose }: { date: string; draft: { vendorId: string; rows: Draft[] }; rows: DemandRow[]; onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const vendors = useQuery({ queryKey: qk.supplyVendors, queryFn: api.supply.vendors });
  const [vendorId, setVendorId] = useState(draft.vendorId);
  const [lines, setLines] = useState(draft.rows);
  const [note, setNote] = useState('');
  const changeVendor = (id: string) => {
    setVendorId(id);
    setLines((ls) => ls.map((l) => ({ ...l, ratePaise: rows.find((r) => r.itemId === l.itemId)?.rates.find((x) => x.vendorId === id)?.ratePaise ?? l.ratePaise })));
  };
  const total = lines.reduce((s, l) => s + costPaise(l.unitType, toBaseQty(l.unitType, Number(l.qty || 0)), l.ratePaise), 0);
  const m = useMutation({
    mutationFn: () =>
      api.supply.createPo({
        vendorId,
        forDate: date,
        note: note || undefined,
        items: lines.filter((l) => Number(l.qty) > 0).map((l) => ({ itemId: l.itemId, orderedQty: toBaseQty(l.unitType, Number(l.qty)), ratePaise: l.ratePaise })),
      }),
    onSuccess: (po) => {
      qc.invalidateQueries({ queryKey: ['supply'] });
      toast.success(`${po.poNo} sent to ${po.vendorName}`);
      nav(`/dashboard/supply/pos/${po.id}`);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="New purchase order"
      footer={
        <>
          <span className="mr-auto self-center text-sm">
            Total <b>{formatINR(total)}</b>
          </span>
          <Button disabled={!vendorId} loading={m.isPending} onClick={() => m.mutate()}>
            Send to vendor
          </Button>
        </>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label="Vendor">
          <Select value={vendorId} onChange={(e) => changeVendor(e.target.value)}>
            <option value="">Choose vendor</option>
            {vendors.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.businessName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note to vendor">
          <Input value={note} placeholder="Deliver by 5 AM" onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <div className="space-y-2">
        {lines.map((l) => (
          <div key={l.itemId} className="grid grid-cols-[1fr_110px_120px_auto] items-center gap-2 text-sm">
            <span className="font-medium">{l.name}</span>
            <div className="flex items-center gap-1">
              <Input type="number" min={0} step="any" value={l.qty} onChange={(e) => setLines((ls) => ls.map((x) => (x.itemId === l.itemId ? { ...x, qty: e.target.value } : x)))} />
              <span className="text-xs text-muted">{rateUnitLabel(l.unitType)}</span>
            </div>
            <MoneyInput value={l.ratePaise} onChange={(v) => setLines((ls) => ls.map((x) => (x.itemId === l.itemId ? { ...x, ratePaise: v } : x)))} />
            <button onClick={() => setLines((ls) => ls.filter((x) => x.itemId !== l.itemId))} className="text-muted hover:text-danger">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function PoList() {
  const [status, setStatus] = useState('');
  const q = useQuery({ queryKey: qk.supplyPos({ status }), queryFn: () => api.supply.pos({ status: status || undefined }) });
  return (
    <>
      <PageHeader
        title="Purchase orders"
        actions={
          <Link to="/dashboard/supply/demand">
            <Button icon={<Plus size={16} />}>From demand</Button>
          </Link>
        }
      />
      <div className="mb-4">
        <Tabs
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'All' },
            { value: 'SENT', label: 'Awaiting vendor' },
            { value: 'ACCEPTED,ADJUSTED', label: 'To receive' },
            { value: 'RECEIVED', label: 'Received' },
            { value: 'REJECTED,CLOSED', label: 'Closed' },
          ]}
        />
      </div>
      {q.isLoading ? (
        <PageLoader />
      ) : !q.data?.length ? (
        <EmptyState icon="/icons/farmer.webp" title="No purchase orders" text="Create one from the demand screen." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>PO</th>
              <th>Vendor</th>
              <th>For</th>
              <th>Items</th>
              <th>Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {q.data.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/dashboard/supply/pos/${p.id}`} className="font-semibold text-primary">
                    {p.poNo}
                  </Link>
                </td>
                <td>{p.vendorName}</td>
                <td>{formatDateLabel(p.forDate)}</td>
                <td>{p.items.length}</td>
                <td>{formatINR(p.totalPaise)}</td>
                <td>
                  <PoBadge status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

function PoDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.supplyPo(id!), queryFn: () => api.supply.po(id!) });
  const [received, setReceived] = useState<Record<string, string> | null>(null);
  const [addToStock, setAddToStock] = useState(true);
  const po = q.data;
  const receivable = po && ['SENT', 'ACCEPTED', 'ADJUSTED'].includes(po.status);
  const receive = useMutation({
    mutationFn: () =>
      api.supply.receive(id!, {
        items: po!.items.map((i) => ({ poItemId: i.id, receivedQty: toBaseQty(i.unitType, Number(received?.[i.id] ?? 0)) })),
        addToStockDate: addToStock ? po!.forDate : null,
      }),
    onSuccess: (p) => {
      qc.setQueryData(qk.supplyPo(p.id), p);
      qc.invalidateQueries({ queryKey: ['supply'] });
      qc.invalidateQueries({ queryKey: ['manage', 'stock'] });
      setReceived(null);
      toast.success(`Goods received. ${formatINR(p.totalPaise)} added to vendor payable.`);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const close = useMutation({ mutationFn: () => api.supply.close(id!), onSuccess: (p) => qc.setQueryData(qk.supplyPo(p.id), p) });
  const totalDraft = useMemo(
    () => (po && received ? po.items.reduce((s, i) => s + costPaise(i.unitType, toBaseQty(i.unitType, Number(received[i.id] ?? 0)), i.ratePaise), 0) : 0),
    [po, received],
  );

  if (q.isLoading || !po) return <PageLoader />;
  return (
    <>
      <button onClick={() => nav(-1)} className="mb-3 flex items-center gap-1 text-sm text-muted hover:text-primary">
        <ArrowLeft size={16} /> Back
      </button>
      <PageHeader
        title={po.poNo}
        subtitle={
          <span className="flex items-center gap-2">
            {po.vendorName} · for {formatDateLabel(po.forDate)} <PoBadge status={po.status} />
          </span>
        }
        actions={
          receivable && !received ? (
            <>
              <Button variant="ghost" onClick={() => close.mutate()}>
                Close PO
              </Button>
              <Button icon={<PackageCheck size={16} />} onClick={() => setReceived(Object.fromEntries(po.items.map((i) => [i.id, String(fromBaseQty(i.unitType, i.acceptedQty ?? i.orderedQty))])))}>
                Receive goods
              </Button>
            </>
          ) : null
        }
      />
      {(po.note || po.vendorNote) && (
        <Card className="mb-4 space-y-1 p-4 text-sm">
          {po.note && <div>Our note: {po.note}</div>}
          {po.vendorNote && <div className="text-[#c25a14]">Vendor: {po.vendorNote}</div>}
        </Card>
      )}
      <Table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Ordered</th>
            <th>Vendor accepted</th>
            <th>Received</th>
            <th>Rate</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {po.items.map((i) => (
            <tr key={i.id}>
              <td className="font-medium text-ink">{i.name}</td>
              <td>{formatQty(i.unitType, i.orderedQty)}</td>
              <td>{i.acceptedQty == null ? '—' : <span className={i.acceptedQty < i.orderedQty ? 'text-[#c25a14]' : ''}>{formatQty(i.unitType, i.acceptedQty)}</span>}</td>
              <td>
                {received ? (
                  <div className="flex items-center gap-1">
                    <Input type="number" min={0} step="any" className="w-24" value={received[i.id] ?? ''} onChange={(e) => setReceived((r) => ({ ...r!, [i.id]: e.target.value }))} />
                    <span className="text-xs text-muted">{rateUnitLabel(i.unitType)}</span>
                  </div>
                ) : i.receivedQty == null ? (
                  '—'
                ) : (
                  formatQty(i.unitType, i.receivedQty)
                )}
              </td>
              <td>
                {formatINR(i.ratePaise)}/{rateUnitLabel(i.unitType)}
              </td>
              <td>{formatINR(costPaise(i.unitType, i.receivedQty ?? i.acceptedQty ?? i.orderedQty, i.ratePaise))}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-4">
        {received ? (
          <>
            <Toggle checked={addToStock} onChange={setAddToStock} label={`Add to sellable stock for ${formatDateLabel(po.forDate).toLowerCase()}`} />
            <span className="text-sm">
              Payable <b>{formatINR(totalDraft)}</b>
            </span>
            <Button variant="ghost" onClick={() => setReceived(null)}>
              Cancel
            </Button>
            <Button loading={receive.isPending} onClick={() => receive.mutate()}>
              Confirm receipt
            </Button>
          </>
        ) : (
          <span className="text-lg font-semibold">Total {formatINR(po.totalPaise)}</span>
        )}
      </div>
    </>
  );
}
