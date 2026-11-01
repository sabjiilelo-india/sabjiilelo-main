import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, LogOut, MapPin, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { qk } from '@sabjiilelo/api-client';
import type { Address } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, EmptyState, Input, PageLoader, Pager } from '../../components/ui';
import { toast } from '../../components/toast';
import { AddressForm } from './AddressForm';

export function AccountPage() {
  const { user, logout, setUser } = useAuth();
  const qc = useQueryClient();
  const addresses = useQuery({ queryKey: qk.addresses, queryFn: api.me.addresses });
  const [name, setName] = useState(user?.name ?? '');
  const [editing, setEditing] = useState<Address | null | 'new'>(null);
  const saveName = useMutation({ mutationFn: () => api.auth.updateMe(name), onSuccess: (u) => (setUser(u), toast.success('Saved')) });
  const del = useMutation({ mutationFn: (id: string) => api.me.deleteAddress(id), onSuccess: () => qc.invalidateQueries({ queryKey: qk.addresses }) });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-light-green text-xl font-semibold text-primary">{(user?.name ?? 'U')[0]}</div>
        <div className="flex-1">
          <div className="text-sm text-muted">+91 {user?.phone}</div>
          <div className="mt-1 flex gap-2">
            <Input value={name} placeholder="Your name" onChange={(e) => setName(e.target.value)} className="max-w-xs" />
            <Button variant="outline" loading={saveName.isPending} disabled={!name.trim() || name === user?.name} onClick={() => saveName.mutate()}>
              Save
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/orders" className="card flex items-center gap-3 p-4 hover:border-primary/40">
          <Package className="text-primary" /> My orders
        </Link>
        <Link to="/notifications" className="card flex items-center gap-3 p-4 hover:border-primary/40">
          <Bell className="text-primary" /> Notifications
        </Link>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base">
            <MapPin size={18} className="text-accent" /> Saved addresses
          </h2>
          <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setEditing('new')}>
            Add
          </Button>
        </div>
        {addresses.isLoading ? (
          <PageLoader />
        ) : !addresses.data?.length ? (
          <p className="text-sm text-muted">No addresses yet.</p>
        ) : (
          <div className="divide-y divide-line/70">
            {addresses.data.map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-3 text-sm">
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-semibold text-ink">
                    {a.label} {a.isDefault && <Badge tone="green">Default</Badge>} {!a.serviceable && <Badge tone="red">Not serviceable</Badge>}
                  </div>
                  <div className="text-muted">
                    {a.name} · {a.phone}
                    <br />
                    {a.line1}
                    {a.landmark ? `, ${a.landmark}` : ''}, {a.city} – {a.pincode}
                  </div>
                </div>
                <button onClick={() => setEditing(a)} className="rounded-lg p-2 text-muted hover:bg-beige" aria-label="Edit">
                  <Pencil size={16} />
                </button>
                <button onClick={() => window.confirm('Delete this address?') && del.mutate(a.id)} className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger" aria-label="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Button variant="ghost" className="text-danger" icon={<LogOut size={16} />} onClick={logout}>
        Log out
      </Button>
      {editing && <AddressForm open onClose={() => setEditing(null)} address={editing === 'new' ? null : editing} />}
    </div>
  );
}

export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [...qk.notifications, page], queryFn: () => api.notifications.list(page) });
  const read = useMutation({ mutationFn: () => api.notifications.markRead(), onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications }) });
  if (q.isLoading) return <PageLoader />;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl">Notifications</h1>
        {!!q.data?.unread && (
          <Button size="sm" variant="ghost" onClick={() => read.mutate()}>
            Mark all read
          </Button>
        )}
      </div>
      {!q.data?.data.length ? (
        <EmptyState title="All caught up" text="Order updates and offers will appear here." />
      ) : (
        <Card className="divide-y divide-line/70">
          {q.data.data.map((n) => (
            <div key={n.id} className={`flex gap-3 p-4 ${n.readAt ? '' : 'bg-mint/60'}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-accent'}`} />
              <div>
                <div className="font-medium text-ink">{n.title}</div>
                <div className="text-sm text-muted">{n.body}</div>
                <div className="mt-1 text-xs text-muted/80">{new Date(n.createdAt).toLocaleString('en-IN')}</div>
              </div>
            </div>
          ))}
        </Card>
      )}
      {q.data && <Pager page={page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />}
    </div>
  );
}
