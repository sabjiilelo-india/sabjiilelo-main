import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPinned, Pencil, Plus, ShieldCheck, Store, Users } from 'lucide-react';
import { qk, type AdminUser } from '@sabjiilelo/api-client';
import { formatINR, type Area } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, MoneyInput, PageHeader, PageLoader, Select, StatCard, Table, Textarea, Toggle } from '../../components/ui';
import { toast } from '../../components/toast';

export default function SuperAdmin({ page }: { page: 'overview' | 'areas' | 'admins' }) {
  if (page === 'overview') return <Overview />;
  if (page === 'areas') return <Areas />;
  return <Admins />;
}

function Overview() {
  const q = useQuery({ queryKey: qk.overview, queryFn: api.superadmin.overview, refetchInterval: 60_000 });
  if (q.isLoading || !q.data) return <PageLoader />;
  const totals = q.data.areas.reduce((s, a) => ({ orders: s.orders + a.todayOrders, revenue: s.revenue + a.todayRevenuePaise, staff: s.staff + a.staffCount }), { orders: 0, revenue: 0, staff: 0 });
  return (
    <>
      <PageHeader title="All areas" subtitle="Today's snapshot across every city" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Areas" value={q.data.areas.length} icon={<Store size={18} />} />
        <StatCard label="Orders today" value={totals.orders} icon={<MapPinned size={18} />} tone="orange" />
        <StatCard label="Revenue today" value={formatINR(totals.revenue)} />
        <StatCard label="Customers" value={q.data.customers} hint={`${totals.staff} staff`} icon={<Users size={18} />} />
      </div>
      <Table>
        <thead>
          <tr>
            <th>Area</th>
            <th>Admin</th>
            <th>Pincodes</th>
            <th>Staff</th>
            <th>Orders today</th>
            <th>Revenue today</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {q.data.areas.map((a) => (
            <tr key={a.id}>
              <td>
                <div className="font-semibold text-ink">{a.name}</div>
                <div className="text-xs text-muted">{a.code}</div>
              </td>
              <td>{a.admin ? `${a.admin.name ?? ''} · ${a.admin.phone}` : <Badge tone="orange">No admin</Badge>}</td>
              <td>{a.pincodes.length}</td>
              <td>{a.staffCount}</td>
              <td>{a.todayOrders}</td>
              <td>{formatINR(a.todayRevenuePaise)}</td>
              <td>{a.isActive ? <Badge tone="green">Live</Badge> : <Badge>Paused</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

function Areas() {
  const q = useQuery({ queryKey: qk.areas, queryFn: api.superadmin.areas });
  const [editing, setEditing] = useState<Area | 'new' | null>(null);
  if (q.isLoading) return <PageLoader />;
  return (
    <>
      <PageHeader
        title="Areas"
        subtitle="Each area is a city with its own pincodes, admin, catalog and staff."
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setEditing('new')}>
            New area
          </Button>
        }
      />
      {!q.data?.length ? (
        <EmptyState title="No areas yet" text="Create your first city to start selling." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg">{a.name}</h3>
                  <p className="text-sm text-muted">
                    {a.city} · code {a.code}
                  </p>
                </div>
                {a.isActive ? <Badge tone="green">Live</Badge> : <Badge>Paused</Badge>}
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {a.pincodes.slice(0, 8).map((p) => (
                  <Badge key={p}>{p}</Badge>
                ))}
                {a.pincodes.length > 8 && <Badge>+{a.pincodes.length - 8}</Badge>}
              </div>
              <div className="mt-3 text-sm text-muted">
                Admin: {a.admin ? `${a.admin.name ?? ''} (${a.admin.phone})` : <span className="text-[#c25a14]">not assigned</span>}
              </div>
              <div className="mt-1 text-xs text-muted">
                Min order {formatINR(a.minOrderPaise)} · Delivery {formatINR(a.deliveryFeePaise)} · Free above {formatINR(a.freeDeliveryAbovePaise)}
              </div>
              <Button size="sm" variant="outline" className="mt-4" icon={<Pencil size={14} />} onClick={() => setEditing(a)}>
                Edit
              </Button>
            </Card>
          ))}
        </div>
      )}
      {editing && <AreaForm area={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function AreaForm({ area, onClose }: { area: Area | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    code: area?.code ?? '',
    name: area?.name ?? '',
    city: area?.city ?? '',
    pincodes: area?.pincodes.join(', ') ?? '',
    isActive: area?.isActive ?? true,
    minOrderPaise: area?.minOrderPaise ?? 9900,
    deliveryFeePaise: area?.deliveryFeePaise ?? 2500,
    freeDeliveryAbovePaise: area?.freeDeliveryAbovePaise ?? 29900,
    autoRefundLimitPaise: area?.autoRefundLimitPaise ?? 20000,
  });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, pincodes: f.pincodes.split(/[\s,]+/).filter(Boolean) };
      return area ? api.superadmin.updateArea(area.id, body) : api.superadmin.createArea(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin'] });
      toast.success(area ? 'Area updated' : 'Area created with Morning & Evening slots');
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={area ? `Edit ${area.name}` : 'New area'}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Code" hint="2–6 letters, e.g. JBP">
          <Input value={f.code} disabled={!!area} maxLength={6} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Area name">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="City">
          <Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
        </Field>
        <Field label="Serviceable pincodes" hint="Separate with commas or spaces" className="sm:col-span-3">
          <Textarea value={f.pincodes} onChange={(e) => setF({ ...f, pincodes: e.target.value })} placeholder="482001, 482002, 482003" />
        </Field>
        <Field label="Minimum order">
          <MoneyInput value={f.minOrderPaise} onChange={(v) => setF({ ...f, minOrderPaise: v })} />
        </Field>
        <Field label="Delivery fee">
          <MoneyInput value={f.deliveryFeePaise} onChange={(v) => setF({ ...f, deliveryFeePaise: v })} />
        </Field>
        <Field label="Free delivery above">
          <MoneyInput value={f.freeDeliveryAbovePaise} onChange={(v) => setF({ ...f, freeDeliveryAbovePaise: v })} />
        </Field>
        <Field label="Auto refund limit" hint="Doorstep refunds up to this are instant">
          <MoneyInput value={f.autoRefundLimitPaise} onChange={(v) => setF({ ...f, autoRefundLimitPaise: v })} />
        </Field>
        <div className="flex items-end pb-2">
          <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Area is live" />
        </div>
      </div>
    </Modal>
  );
}

function Admins() {
  const qc = useQueryClient();
  const admins = useQuery({ queryKey: qk.admins, queryFn: api.superadmin.admins });
  const areas = useQuery({ queryKey: qk.areas, queryFn: api.superadmin.areas });
  const [editing, setEditing] = useState<AdminUser | 'new' | null>(null);
  const toggle = useMutation({
    mutationFn: (a: AdminUser) => api.superadmin.updateAdmin(a.id, { status: a.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin'] }),
    onError: (e) => toast.error((e as Error).message),
  });
  if (admins.isLoading || areas.isLoading) return <PageLoader />;
  const freeAreas = (areas.data ?? []).filter((a) => !a.admin);
  return (
    <>
      <PageHeader
        title="Area admins"
        subtitle="Each area has exactly one admin. They sign in with their phone and OTP."
        actions={
          <Button icon={<Plus size={16} />} disabled={!freeAreas.length} onClick={() => setEditing('new')}>
            Assign admin
          </Button>
        }
      />
      <Table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Area</th>
            <th>Last login</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {admins.data?.map((a) => (
            <tr key={a.id}>
              <td className="font-medium text-ink">
                <ShieldCheck size={16} className="mr-1.5 inline text-primary" />
                {a.name}
              </td>
              <td>{a.phone}</td>
              <td>{a.area ? `${a.area.name} (${a.area.code})` : '—'}</td>
              <td className="text-muted">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('en-IN') : 'Never'}</td>
              <td>{a.status === 'ACTIVE' ? <Badge tone="green">Active</Badge> : <Badge tone="red">Blocked</Badge>}</td>
              <td className="text-right">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(a)}>
                    Edit
                  </Button>
                  <Button size="sm" variant={a.status === 'ACTIVE' ? 'ghost' : 'secondary'} onClick={() => toggle.mutate(a)}>
                    {a.status === 'ACTIVE' ? 'Block' : 'Unblock'}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {editing && <AdminForm admin={editing === 'new' ? null : editing} areas={areas.data ?? []} onClose={() => setEditing(null)} />}
    </>
  );
}

function AdminForm({ admin, areas, onClose }: { admin: AdminUser | null; areas: Area[]; onClose: () => void }) {
  const qc = useQueryClient();
  const options = areas.filter((a) => !a.admin || a.id === admin?.areaId);
  const [f, setF] = useState({ phone: admin?.phone ?? '', name: admin?.name ?? '', areaId: admin?.areaId ?? options[0]?.id ?? '' });
  const save = useMutation({
    mutationFn: () => (admin ? api.superadmin.updateAdmin(admin.id, { name: f.name, areaId: f.areaId }) : api.superadmin.createAdmin(f)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin'] });
      toast.success('Saved. They can now log in with OTP.');
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={admin ? 'Edit admin' : 'Assign area admin'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Mobile number">
          <Input inputMode="numeric" maxLength={10} disabled={!!admin} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '') })} />
        </Field>
        <Field label="Full name">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Area">
          <Select value={f.areaId} onChange={(e) => setF({ ...f, areaId: e.target.value })}>
            {options.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
