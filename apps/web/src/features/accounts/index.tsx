import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { qk, type AccountIssue } from '@sabjiilelo/api-client';
import {
  ISSUE_TYPE_LABEL,
  addDays,
  formatDateLabel,
  formatINR,
  formatQty,
  todayIST,
  type CodRow,
  type VendorBalance,
} from '@sabjiilelo/shared';
import { api, openBlob } from '../../lib/api';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, MoneyInput, PageHeader, PageLoader, StatCard, Table, Tabs } from '../../components/ui';
import { toast } from '../../components/toast';

export default function Accounts({ page }: { page: 'cod' | 'vendors' | 'refunds' | 'issues' | 'reports' }) {
  switch (page) {
    case 'cod':
      return <Cod />;
    case 'vendors':
      return <VendorPayouts />;
    case 'refunds':
      return <Refunds />;
    case 'issues':
      return <Issues />;
    case 'reports':
      return <Reports />;
  }
}

function Cod() {
  const [date, setDate] = useState(todayIST());
  const q = useQuery({ queryKey: qk.cod(date), queryFn: () => api.accounts.cod(date) });
  const [settle, setSettle] = useState<CodRow | null>(null);
  return (
    <>
      <PageHeader
        title="COD cash"
        subtitle="Cash collected by delivery partners. Count it, then mark it received."
        actions={<Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />}
      />
      {q.isLoading || !q.data ? (
        <PageLoader />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Expected" value={formatINR(q.data.totals.expectedPaise)} />
            <StatCard label="Received" value={formatINR(q.data.totals.depositedPaise)} />
            <StatCard
              label="Pending"
              value={formatINR(Math.max(0, q.data.totals.expectedPaise - q.data.totals.depositedPaise))}
              tone={q.data.totals.expectedPaise > q.data.totals.depositedPaise ? 'red' : 'green'}
            />
          </div>
          {!q.data.rows.length ? (
            <EmptyState title="No cash collected" text={`No COD deliveries on ${formatDateLabel(date).toLowerCase()}.`} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Delivery partner</th>
                  <th>COD deliveries</th>
                  <th>Expected</th>
                  <th>Received</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {q.data.rows.map((r) => (
                  <tr key={r.riderId}>
                    <td>
                      <div className="font-medium text-ink">{r.riderName}</div>
                      <div className="text-xs text-muted">{r.phone}</div>
                    </td>
                    <td>{r.deliveredCount}</td>
                    <td className="font-semibold">{formatINR(r.codExpectedPaise)}</td>
                    <td>{formatINR(r.depositedPaise)}</td>
                    <td>
                      <Badge tone={r.status === 'SETTLED' ? 'green' : r.status === 'SHORT' ? 'red' : 'yellow'}>{r.status.toLowerCase()}</Badge>
                      {r.note && <div className="text-xs text-muted">{r.note}</div>}
                    </td>
                    <td className="text-right">
                      <Button size="sm" variant={r.status === 'SETTLED' ? 'outline' : 'primary'} onClick={() => setSettle(r)}>
                        {r.status === 'SETTLED' ? 'Edit' : 'Receive cash'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}
      {settle && <SettleModal row={settle} onClose={() => setSettle(null)} />}
    </>
  );
}

function SettleModal({ row, onClose }: { row: CodRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(row.depositedPaise || row.codExpectedPaise);
  const [note, setNote] = useState(row.note ?? '');
  const m = useMutation({
    mutationFn: () => api.accounts.settleCod(row.riderId, { date: row.date, depositedPaise: amount, note: note || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts', 'cod'] });
      toast.success(amount >= row.codExpectedPaise ? 'Settled' : 'Recorded as short');
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal open onClose={onClose} title={`Cash from ${row.riderName}`} footer={<Button loading={m.isPending} onClick={() => m.mutate()}>Save</Button>}>
      <p className="mb-4 text-sm">
        Expected <b>{formatINR(row.codExpectedPaise)}</b> from {row.deliveredCount} COD deliveries.
      </p>
      <div className="space-y-4">
        <Field label="Cash received">
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
        {amount < row.codExpectedPaise && <p className="text-sm text-danger">Short by {formatINR(row.codExpectedPaise - amount)}</p>}
        <Field label="Note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function VendorPayouts() {
  const q = useQuery({ queryKey: qk.vendorBalances, queryFn: api.accounts.vendors });
  const [pay, setPay] = useState<VendorBalance | null>(null);
  const [ledger, setLedger] = useState<VendorBalance | null>(null);
  const total = (q.data ?? []).reduce((s, v) => s + v.balancePaise, 0);
  return (
    <>
      <PageHeader title="Vendor payouts" subtitle={`Outstanding to vendors: ${formatINR(total)}`} />
      {q.isLoading ? (
        <PageLoader />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Goods received</th>
              <th>Paid</th>
              <th>Balance</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {q.data?.map((v) => (
              <tr key={v.vendorId}>
                <td>
                  <div className="font-medium text-ink">{v.businessName}</div>
                  <div className="text-xs text-muted">{v.phone}</div>
                </td>
                <td>{formatINR(v.payablePaise)}</td>
                <td>{formatINR(v.paidPaise)}</td>
                <td className={v.balancePaise > 0 ? 'font-semibold text-[#c25a14]' : 'text-primary'}>{formatINR(v.balancePaise)}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setLedger(v)}>
                      Ledger
                    </Button>
                    <Button size="sm" disabled={v.balancePaise <= 0} onClick={() => setPay(v)}>
                      Pay
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {pay && <PayModal vendor={pay} onClose={() => setPay(null)} />}
      {ledger && <LedgerModal vendor={ledger} onClose={() => setLedger(null)} />}
    </>
  );
}

function PayModal({ vendor, onClose }: { vendor: VendorBalance; onClose: () => void }) {
  const qc = useQueryClient();
  const details = useQuery({ queryKey: qk.vendorLedgerAcc(vendor.vendorId), queryFn: () => api.accounts.vendorLedger(vendor.vendorId) });
  const [amount, setAmount] = useState(vendor.balancePaise);
  const [reference, setReference] = useState('');
  const m = useMutation({
    mutationFn: () => api.accounts.payVendor(vendor.vendorId, { amountPaise: amount, reference: reference || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Payment recorded');
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const v = details.data?.vendor;
  return (
    <Modal open onClose={onClose} title={`Pay ${vendor.businessName}`} footer={<Button loading={m.isPending} disabled={amount <= 0} onClick={() => m.mutate()}>Record payment</Button>}>
      {v && (
        <div className="mb-4 rounded-xl bg-cream p-3 text-sm">
          {v.upiId && <div>UPI: {v.upiId}</div>}
          {v.bankAccount && (
            <div>
              Bank: {v.bankAccount} {v.ifsc && `· ${v.ifsc}`}
            </div>
          )}
          {!v.upiId && !v.bankAccount && <div className="text-muted">No payout details on file.</div>}
        </div>
      )}
      <div className="space-y-4">
        <Field label="Amount paid">
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="UTR / reference">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function LedgerModal({ vendor, onClose }: { vendor: VendorBalance; onClose: () => void }) {
  const q = useQuery({ queryKey: qk.vendorLedgerAcc(vendor.vendorId), queryFn: () => api.accounts.vendorLedger(vendor.vendorId) });
  return (
    <Modal open onClose={onClose} title={`${vendor.businessName} ledger`} wide>
      {q.isLoading ? (
        <PageLoader />
      ) : (
        <table className="table-base">
          <thead>
            <tr>
              <th>Date</th>
              <th>Entry</th>
              <th>Reference</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.entries.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.createdAt).toLocaleDateString('en-IN')}</td>
                <td>{e.type === 'PAYABLE' ? `Goods ${e.poNo ?? ''}` : 'Payment'}</td>
                <td className="text-muted">{e.reference ?? e.note}</td>
                <td className={`text-right font-medium ${e.type === 'PAYMENT' ? 'text-primary' : ''}`}>
                  {e.type === 'PAYMENT' ? '– ' : '+ '}
                  {formatINR(e.amountPaise)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

function Refunds() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'REQUESTED' | 'ALL'>('REQUESTED');
  const q = useQuery({ queryKey: qk.refunds(status), queryFn: () => api.accounts.refunds(status) });
  const decide = useMutation({
    mutationFn: ({ id, ok }: { id: string; ok: boolean }) => (ok ? api.accounts.approveRefund(id) : api.accounts.rejectRefund(id, window.prompt('Reason for rejecting?') ?? undefined)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts', 'refunds'] });
      toast.success('Done');
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <>
      <PageHeader title="Refunds" subtitle="Doorstep returns above the instant limit wait here for approval." />
      <div className="mb-4">
        <Tabs value={status} onChange={setStatus} options={[{ value: 'REQUESTED', label: 'Waiting' }, { value: 'ALL', label: 'All' }]} />
      </div>
      {q.isLoading ? (
        <PageLoader />
      ) : !q.data?.length ? (
        <EmptyState title="No refunds waiting" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Reason</th>
              <th>Amount</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {q.data.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link to={`/dashboard/orders/${r.orderId}`} className="font-semibold text-primary">
                    #{r.orderNo}
                  </Link>
                  <div className="text-xs text-muted">{r.paymentMode}</div>
                </td>
                <td>
                  {r.customerName}
                  <div className="text-xs text-muted">{r.customerPhone}</div>
                </td>
                <td className="max-w-xs text-sm">
                  <Badge>{r.source.toLowerCase()}</Badge> {r.reason}
                </td>
                <td className="font-semibold">{formatINR(r.amountPaise)}</td>
                <td>
                  <Badge tone={r.status === 'PROCESSED' ? 'green' : r.status === 'REJECTED' ? 'red' : 'yellow'}>{r.status.toLowerCase()}</Badge>
                  {r.auto && <div className="text-[11px] text-muted">auto</div>}
                </td>
                <td className="text-right">
                  {r.status === 'REQUESTED' && (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => decide.mutate({ id: r.id, ok: false })}>
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => decide.mutate({ id: r.id, ok: true })}>
                        Approve
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

function Issues() {
  const [status, setStatus] = useState<'OPEN' | 'ALL'>('OPEN');
  const q = useQuery({ queryKey: qk.issues(status), queryFn: () => api.accounts.issues(status) });
  const [resolving, setResolving] = useState<AccountIssue | null>(null);
  return (
    <>
      <PageHeader title="Customer issues" subtitle="Reported within 24 hours of delivery. Approve to refund." />
      <div className="mb-4">
        <Tabs value={status} onChange={setStatus} options={[{ value: 'OPEN', label: 'Open' }, { value: 'ALL', label: 'All' }]} />
      </div>
      {q.isLoading ? (
        <PageLoader />
      ) : !q.data?.length ? (
        <EmptyState title="No open issues" text="Happy customers 🎉" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.map((i) => (
            <Card key={i.id} className="flex gap-4 p-4">
              {i.photoUrl ? (
                <a href={i.photoUrl} target="_blank" rel="noreferrer">
                  <img src={i.photoUrl} alt="" className="h-24 w-24 rounded-xl object-cover" />
                </a>
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-beige text-xs text-muted">No photo</div>
              )}
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex items-center gap-2">
                  <Badge tone="orange">{ISSUE_TYPE_LABEL[i.type]}</Badge>
                  <Badge tone={i.status === 'OPEN' ? 'yellow' : i.status === 'APPROVED' ? 'green' : 'red'}>{i.status.toLowerCase()}</Badge>
                </div>
                <div className="mt-1 font-medium text-ink">{i.itemName ?? 'Whole order'}</div>
                {i.description && <p className="text-muted">{i.description}</p>}
                <div className="mt-1 text-xs text-muted">
                  <Link to={`/dashboard/orders/${i.orderId}`} className="text-primary">
                    #{i.orderNo}
                  </Link>{' '}
                  · {i.customerName} · {i.paymentMode}
                </div>
                {i.status === 'OPEN' && (
                  <Button size="sm" className="mt-2" onClick={() => setResolving(i)}>
                    Review
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      {resolving && <ResolveModal issue={resolving} onClose={() => setResolving(null)} />}
    </>
  );
}

function ResolveModal({ issue, onClose }: { issue: AccountIssue; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(issue.suggestedRefundPaise);
  const [note, setNote] = useState('');
  const m = useMutation({
    mutationFn: (approve: boolean) => api.accounts.resolveIssue(issue.id, { action: approve ? 'APPROVE' : 'REJECT', refundPaise: approve ? amount : undefined, note: note || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Issue resolved');
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Issue on #${issue.orderNo}`}
      footer={
        <>
          <Button variant="ghost" loading={m.isPending} onClick={() => m.mutate(false)}>
            Reject
          </Button>
          <Button loading={m.isPending} onClick={() => m.mutate(true)}>
            Approve refund
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Refund amount" hint={issue.paymentMode === 'COD' ? 'COD order: pay the customer back by UPI/cash; it is recorded as settled.' : 'Sent back to the original payment method.'}>
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="Note to customer">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function Reports() {
  const [from, setFrom] = useState(addDays(todayIST(), -6));
  const [to, setTo] = useState(todayIST());
  const q = useQuery({ queryKey: qk.sales(from, to), queryFn: () => api.reports.sales(from, to) });
  const r = q.data;
  const max = Math.max(1, ...(r?.byDay.map((d) => d.netPaise) ?? [1]));
  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Delivered sales by delivery date."
        actions={
          <>
            <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-muted">to</span>
            <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        }
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {(['orders', 'items', 'purchases'] as const).map((k) => (
          <Button key={k} variant="outline" size="sm" icon={<Download size={14} />} onClick={() => openBlob(api.reports.csv(k, from, to), `${k}-${from}-to-${to}.csv`)}>
            {k[0]!.toUpperCase() + k.slice(1)} CSV
          </Button>
        ))}
      </div>
      {!r ? (
        <PageLoader />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Net sales" value={formatINR(r.totals.netPaise)} hint={`${r.totals.orders} orders`} />
            <StatCard label="Gross item value" value={formatINR(r.totals.grossPaise)} />
            <StatCard label="Discounts" value={formatINR(r.totals.discountPaise)} tone="orange" />
            <StatCard label="Refunds" value={formatINR(r.totals.refundsPaise)} tone="red" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-4 text-base">Net sales by day</h2>
              <div className="space-y-2">
                {r.byDay.map((d) => (
                  <div key={d.date} className="flex items-center gap-3 text-sm">
                    <span className="w-20 shrink-0 text-muted">{formatDateLabel(d.date)}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded-full bg-beige">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(d.netPaise / max) * 100}%` }} />
                    </div>
                    <span className="w-24 text-right font-medium">{formatINR(d.netPaise)}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <h2 className="mb-4 text-base">By payment & channel</h2>
              <table className="table-base">
                <tbody>
                  {r.byPaymentMode.map((m) => (
                    <tr key={m.mode}>
                      <td>{m.mode}</td>
                      <td>{m.orders} orders</td>
                      <td className="text-right font-medium">{formatINR(m.netPaise)}</td>
                    </tr>
                  ))}
                  {r.byChannel.map((c) => (
                    <tr key={c.channel}>
                      <td className="text-muted">{c.channel}</td>
                      <td className="text-muted">{c.orders} orders</td>
                      <td className="text-right text-muted">{formatINR(c.netPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
          <Card className="p-5">
            <h2 className="mb-3 text-base">Top items</h2>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity sold</th>
                  <th className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {r.topItems.map((i) => (
                  <tr key={i.itemId}>
                    <td className="font-medium text-ink">{i.name}</td>
                    <td>{formatQty(i.unitType, i.baseQty)}</td>
                    <td className="text-right">{formatINR(i.revenuePaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </>
  );
}
