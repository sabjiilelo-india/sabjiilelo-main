import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Users } from 'lucide-react';
import { qk } from '@sabjiilelo/api-client';
import { ROLE_LABEL, type Role, type StaffUser } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, PageLoader, Pager, Select, Table, Tabs } from '../../components/ui';
import { toast } from '../../components/toast';
import { confirm } from '../../components/confirm';

const STAFF_ROLES = ['MANAGER', 'ACCOUNTANT', 'HR', 'DELIVERY', 'VENDOR'] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

export function Staff() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const initialRole = params.get('role') as StaffRole | null;
  const addRole = params.get('add') as StaffRole | null;
  const [role, setRole] = useState<Role | 'ALL'>(initialRole && STAFF_ROLES.includes(initialRole) ? initialRole : 'ALL');
  const q = useQuery({ queryKey: qk.staff(role), queryFn: () => api.staff.list(role === 'ALL' ? undefined : role) });
  const [editing, setEditing] = useState<StaffUser | 'new' | null>(addRole && STAFF_ROLES.includes(addRole) ? 'new' : null);
  const [newRole, setNewRole] = useState<StaffRole>(addRole && STAFF_ROLES.includes(addRole) ? addRole : 'DELIVERY');
  // Opening via ?add=VENDOR (dashboard shortcut) should not reopen the form after closing it.
  useEffect(() => {
    if (addRole) setParams((p) => (p.delete('add'), p), { replace: true });
  }, []);
  useEffect(() => {
    setRole(initialRole && STAFF_ROLES.includes(initialRole) ? initialRole : 'ALL');
  }, [initialRole]);
  const toggle = useMutation({
    mutationFn: (u: StaffUser) => api.staff.update(u.id, { status: u.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Add a phone number with a role. They can log in only after you add them."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Plus size={16} />}
              onClick={() => {
                setNewRole('VENDOR');
                setEditing('new');
              }}
            >
              Add vendor
            </Button>
            <Button
              icon={<Plus size={16} />}
              onClick={() => {
                setNewRole(role !== 'ALL' && STAFF_ROLES.includes(role as StaffRole) ? (role as StaffRole) : 'DELIVERY');
                setEditing('new');
              }}
            >
              Add staff
            </Button>
          </>
        }
      />
      <div className="mb-4">
        <Tabs value={role} onChange={setRole} options={[{ value: 'ALL' as const, label: 'All' }, ...STAFF_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))]} />
      </div>
      {q.isLoading ? (
        <PageLoader />
      ) : !q.data?.length ? (
        <EmptyState title="No staff yet" text="Add managers, accountants, delivery partners and vendors for your area." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Last login</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {q.data.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="font-medium text-ink">{u.name}</div>
                  {u.vendor && <div className="text-xs text-muted">{u.vendor.businessName}</div>}
                </td>
                <td>{u.phone}</td>
                <td>
                  <Badge tone={u.role === 'DELIVERY' ? 'orange' : u.role === 'VENDOR' ? 'blue' : 'green'}>{ROLE_LABEL[u.role]}</Badge>
                  {u.role === 'DELIVERY' && u.isOnline && <span className="ml-2 text-xs text-primary">● online</span>}
                </td>
                <td className="text-muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-IN') : 'Never'}</td>
                <td>{u.status === 'ACTIVE' ? <Badge tone="green">Active</Badge> : <Badge tone="red">Blocked</Badge>}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(u)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={async () => (await confirm(u.status === 'ACTIVE' ? { title: `Block ${u.name ?? u.phone}?`, message: 'They will be signed out and cannot log in until unblocked.', tone: 'danger', confirmText: 'Block' } : { title: `Unblock ${u.name ?? u.phone}?`, confirmText: 'Unblock' })) && toggle.mutate(u)}>
                      {u.status === 'ACTIVE' ? 'Block' : 'Unblock'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {editing && <StaffForm user={editing === 'new' ? null : editing} defaultRole={newRole} onClose={() => setEditing(null)} />}
    </>
  );
}

function StaffForm({ user, onClose, defaultRole = 'DELIVERY' }: { user: StaffUser | null; onClose: () => void; defaultRole?: StaffRole }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    phone: user?.phone ?? '',
    name: user?.name ?? '',
    role: (user?.role ?? defaultRole) as StaffRole,
    businessName: user?.vendor?.businessName ?? '',
    gstin: user?.vendor?.gstin ?? '',
    bankAccount: user?.vendor?.bankAccount ?? '',
    ifsc: user?.vendor?.ifsc ?? '',
    upiId: user?.vendor?.upiId ?? '',
  });
  const vendor = f.role === 'VENDOR' ? { businessName: f.businessName, gstin: f.gstin || null, bankAccount: f.bankAccount || null, ifsc: f.ifsc || null, upiId: f.upiId || null } : undefined;
  const m = useMutation({
    mutationFn: () => (user ? api.staff.update(user.id, { name: f.name, role: f.role, vendor }) : api.staff.create({ phone: f.phone, name: f.name, role: f.role, vendor })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      toast.success(user ? 'Saved' : `${f.name} can now log in with OTP`);
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal open onClose={onClose} title={user ? 'Edit staff' : f.role === 'VENDOR' ? 'Add vendor (supplier)' : 'Add staff'} footer={<Button loading={m.isPending} onClick={() => m.mutate()}>Save</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mobile number">
          <Input inputMode="numeric" maxLength={10} disabled={!!user} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '') })} />
        </Field>
        <Field label="Full name">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Role" className="sm:col-span-2">
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as StaffRole })}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        {f.role === 'VENDOR' && (
          <>
            <Field label="Business name" className="sm:col-span-2">
              <Input value={f.businessName} onChange={(e) => setF({ ...f, businessName: e.target.value })} />
            </Field>
            <Field label="GSTIN (optional)">
              <Input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value })} />
            </Field>
            <Field label="UPI ID">
              <Input value={f.upiId} onChange={(e) => setF({ ...f, upiId: e.target.value })} />
            </Field>
            <Field label="Bank account">
              <Input value={f.bankAccount} onChange={(e) => setF({ ...f, bankAccount: e.target.value })} />
            </Field>
            <Field label="IFSC">
              <Input value={f.ifsc} onChange={(e) => setF({ ...f, ifsc: e.target.value.toUpperCase() })} />
            </Field>
          </>
        )}
      </div>
      {!user && <p className="mt-4 text-xs text-muted">If this number already shops as a customer, it will be converted to this staff role.</p>}
    </Modal>
  );
}

export function Feedback() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: qk.ratings(page), queryFn: () => api.manage.ratings(page) });
  if (q.isLoading || !q.data) return <PageLoader />;
  return (
    <>
      <PageHeader title="Customer ratings" subtitle={q.data.average ? `Average ${q.data.average.toFixed(2)} ★ from ${q.data.total} ratings` : 'No ratings yet'} />
      {!q.data.data.length ? (
        <EmptyState title="No ratings yet" />
      ) : (
        <div className="space-y-3">
          {q.data.data.map((r) => (
            <Card key={r.id} className="flex items-start gap-4 p-4">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={16} className={s <= r.stars ? 'fill-accent text-accent' : 'text-line'} />
                ))}
              </div>
              <div className="flex-1 text-sm">
                <div className="text-ink">{r.comment || <span className="text-muted">No comment</span>}</div>
                <div className="text-xs text-muted">
                  #{r.orderNo} · {r.customerName} · {new Date(r.createdAt).toLocaleDateString('en-IN')}
                </div>
              </div>
            </Card>
          ))}
          <Pager page={page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />
        </div>
      )}
    </>
  );
}

export function HrHome() {
  const q = useQuery({ queryKey: qk.staff('DELIVERY'), queryFn: () => api.staff.list('DELIVERY').catch(() => []) });
  return (
    <>
      <PageHeader title="HR" subtitle="Staff onboarding, KYC, attendance and payroll arrive in phase 2." />
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <Users size={40} className="text-primary" />
        <h2 className="text-lg">Coming soon</h2>
        <p className="max-w-md text-sm text-muted">Until then your area admin adds staff from the Staff page. You'll be able to manage documents, shifts and salaries here.</p>
        {!!q.data?.length && <p className="text-sm">{q.data.length} delivery partners currently on the team.</p>}
      </Card>
    </>
  );
}
