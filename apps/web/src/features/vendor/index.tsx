import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { qk } from '@sabjiilelo/api-client';
import { costPaise, formatDateLabel, formatINR, formatQty, fromBaseQty, rateUnitLabel, toBaseQty, todayIST } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { Button, Card, EmptyState, Field, Input, PageHeader, PageLoader, StatCard, Table, Tabs } from '../../components/ui';
import { toast } from '../../components/toast';
import { PoBadge } from '../supply';

export default function VendorPortal({ page }: { page: 'orders' | 'order' | 'rates' | 'ledger' }) {
  switch (page) {
    case 'orders':
      return <VendorOrders />;
    case 'order':
      return <VendorOrder />;
    case 'rates':
      return <Rates />;
    case 'ledger':
      return <Ledger />;
  }
}

function VendorOrders() {
  const [status, setStatus] = useState('SENT');
  const q = useQuery({ queryKey: qk.vendorPos(status), queryFn: () => api.vendor.pos(status || undefined) });
  return (
    <>
      <PageHeader title="Purchase orders" subtitle="Requests from Sabjii Le Lo. Accept, adjust quantities or decline." />
      <div className="mb-4">
        <Tabs value={status} onChange={setStatus} options={[{ value: 'SENT', label: 'New' }, { value: 'ACCEPTED,ADJUSTED', label: 'Accepted' }, { value: '', label: 'All' }]} />
      </div>
      {q.isLoading ? (
        <PageLoader />
      ) : !q.data?.length ? (
        <EmptyState icon="/icons/farmer.webp" title="No orders" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {q.data.map((p) => (
            <Link key={p.id} to={`/dashboard/vendor/orders/${p.id}`} className="card p-4 hover:border-primary/40">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">{p.poNo}</span>
                <PoBadge status={p.status} />
              </div>
              <div className="mt-1 text-sm text-muted">
                For {formatDateLabel(p.forDate)} · {p.items.length} items · {formatINR(p.totalPaise)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function VendorOrder() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.vendorPo(id!), queryFn: () => api.vendor.po(id!) });
  const [qty, setQty] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  useEffect(() => {
    if (q.data) setQty(Object.fromEntries(q.data.items.map((i) => [i.id, String(fromBaseQty(i.unitType, i.acceptedQty ?? i.orderedQty))])));
  }, [q.data]);
  const respond = useMutation({
    mutationFn: (action: 'ACCEPT' | 'ADJUST' | 'REJECT') =>
      api.vendor.respond(id!, { action, note: note || undefined, items: q.data!.items.map((i) => ({ poItemId: i.id, acceptedQty: toBaseQty(i.unitType, Number(qty[i.id] ?? 0)) })) }),
    onSuccess: (p) => {
      qc.setQueryData(qk.vendorPo(p.id), p);
      qc.invalidateQueries({ queryKey: ['vendor', 'pos'] });
      toast.success('Response sent');
    },
    onError: (e) => toast.error((e as Error).message),
  });
  if (q.isLoading || !q.data) return <PageLoader />;
  const p = q.data;
  const editable = ['SENT', 'ACCEPTED', 'ADJUSTED'].includes(p.status);
  const changed = p.items.some((i) => toBaseQty(i.unitType, Number(qty[i.id] ?? 0)) !== i.orderedQty);
  return (
    <>
      <button onClick={() => nav(-1)} className="mb-3 flex items-center gap-1 text-sm text-muted hover:text-primary">
        <ArrowLeft size={16} /> Back
      </button>
      <PageHeader title={p.poNo} subtitle={<span className="flex items-center gap-2">Deliver for {formatDateLabel(p.forDate)} <PoBadge status={p.status} /></span>} />
      {p.note && <Card className="mb-4 p-4 text-sm">Note from store: {p.note}</Card>}
      <Table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Requested</th>
            <th>You can supply</th>
            <th>Rate</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {p.items.map((i) => (
            <tr key={i.id}>
              <td className="font-medium text-ink">{i.name}</td>
              <td>{formatQty(i.unitType, i.orderedQty)}</td>
              <td>
                {editable ? (
                  <div className="flex items-center gap-1">
                    <Input type="number" min={0} step="any" className="w-24" value={qty[i.id] ?? ''} onChange={(e) => setQty((s) => ({ ...s, [i.id]: e.target.value }))} />
                    <span className="text-xs text-muted">{rateUnitLabel(i.unitType)}</span>
                  </div>
                ) : (
                  formatQty(i.unitType, i.acceptedQty ?? 0)
                )}
              </td>
              <td>
                {formatINR(i.ratePaise)}/{rateUnitLabel(i.unitType)}
              </td>
              <td>{formatINR(costPaise(i.unitType, toBaseQty(i.unitType, Number(qty[i.id] ?? 0)), i.ratePaise))}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {editable && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Note (optional)" className="min-w-[240px] flex-1">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Button variant="ghost" className="text-danger" loading={respond.isPending} onClick={() => respond.mutate('REJECT')}>
            Decline
          </Button>
          <Button loading={respond.isPending} onClick={() => respond.mutate(changed ? 'ADJUST' : 'ACCEPT')}>
            {changed ? 'Send adjusted quantities' : 'Accept order'}
          </Button>
        </div>
      )}
    </>
  );
}

function Rates() {
  const [date, setDate] = useState(todayIST());
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.vendorRates(date), queryFn: () => api.vendor.rates(date) });
  const [edits, setEdits] = useState<Record<string, string>>({});
  useEffect(() => {
    setEdits({});
  }, [date]);
  const save = useMutation({
    mutationFn: () =>
      api.vendor.saveRates({
        date,
        rates: Object.entries(edits)
          .filter(([, v]) => Number(v) > 0)
          .map(([itemId, v]) => ({ itemId, ratePaise: Math.round(Number(v) * 100) })),
      }),
    onSuccess: (r) => {
      toast.success(`${r.saved} rates saved`);
      setEdits({});
      qc.invalidateQueries({ queryKey: qk.vendorRates(date) });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <>
      <PageHeader
        title="Today's rates"
        subtitle="Quote your price per kg / piece. The store picks the best rates when ordering."
        actions={
          <>
            <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
            <Button icon={<Save size={16} />} disabled={!Object.keys(edits).length} loading={save.isPending} onClick={() => save.mutate()}>
              Save rates
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
              <th>Item</th>
              <th>Your rate (₹)</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.rates.map((r) => (
              <tr key={r.itemId}>
                <td className="font-medium text-ink">{r.name}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.5"
                      className="w-28"
                      placeholder="—"
                      value={edits[r.itemId] ?? (r.ratePaise != null ? r.ratePaise / 100 : '')}
                      onChange={(e) => setEdits((s) => ({ ...s, [r.itemId]: e.target.value }))}
                    />
                    <span className="text-xs text-muted">per {rateUnitLabel(r.unitType)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

function Ledger() {
  const q = useQuery({ queryKey: qk.vendorLedger, queryFn: api.vendor.ledger });
  if (q.isLoading || !q.data) return <PageLoader />;
  return (
    <>
      <PageHeader title="Payments" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Goods supplied" value={formatINR(q.data.payablePaise)} />
        <StatCard label="Paid to you" value={formatINR(q.data.paidPaise)} />
        <StatCard label="Due" value={formatINR(q.data.balancePaise)} tone={q.data.balancePaise > 0 ? 'orange' : 'green'} />
      </div>
      <Table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Entry</th>
            <th>Reference</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {q.data.entries.map((e) => (
            <tr key={e.id}>
              <td>{new Date(e.createdAt).toLocaleDateString('en-IN')}</td>
              <td>{e.type === 'PAYABLE' ? `Supplied (${e.poNo})` : 'Payment received'}</td>
              <td className="text-muted">{e.reference ?? e.note}</td>
              <td className={`text-right font-medium ${e.type === 'PAYMENT' ? 'text-primary' : ''}`}>{formatINR(e.amountPaise)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
