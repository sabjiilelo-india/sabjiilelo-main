import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  FileText,
  HelpCircle,
  Info,
  LogOut,
  MapPin,
  Package,
  Pencil,
  Plus,
  Settings,
  Shield,
  Trash2,
  UserRound,
} from 'lucide-react';
import clsx from 'clsx';
import { qk } from '@sabjiilelo/api-client';
import { APP_VERSION, PRIVACY, SUPPORT, TERMS, type Address } from '@sabjiilelo/shared';
import { api, tokenStore } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, EmptyState, Field, Input, PageLoader, Pager, Toggle } from '../../components/ui';
import { toast } from '../../components/toast';
import { confirm } from '../../components/confirm';
import { AddressForm } from './AddressForm';
import { HelpContent, LegalContent } from './Help';

const MENU = [
  { to: '/account/profile', label: 'Edit profile', icon: UserRound, hint: 'Name, email' },
  { to: '/orders', label: 'My orders', icon: Package, hint: 'Track, reorder, invoices' },
  { to: '/account/addresses', label: 'Saved addresses', icon: MapPin, hint: 'Home, work & more' },
  { to: '/notifications', label: 'Notifications', icon: Bell, hint: 'Order updates' },
  { to: '/account/settings', label: 'Settings', icon: Settings, hint: 'Alerts, account' },
  { to: '/help', label: 'Help & support', icon: HelpCircle, hint: 'FAQs, call, WhatsApp' },
  { to: '/terms', label: 'Terms & conditions', icon: FileText },
  { to: '/privacy', label: 'Privacy policy', icon: Shield },
  { to: '/about', label: 'About Sabjii Le Lo', icon: Info },
];

/** Logs out after confirmation; shared by every logout button. */
export function useConfirmLogout() {
  const { logout } = useAuth();
  const nav = useNavigate();
  return async () => {
    if (!(await confirm({ title: 'Log out?', message: 'You can log back in any time with your mobile number.', confirmText: 'Log out', tone: 'danger', icon: 'logout' }))) return;
    await logout();
    toast.success('Logged out', 'See you again soon!');
    nav('/');
  };
}

function ProfileCard() {
  const { user } = useAuth();
  const orders = useQuery({ queryKey: [...qk.myOrders, 1], queryFn: () => api.me.orders(1), enabled: user?.role === 'CUSTOMER' });
  const since = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '';
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-dark-green p-5 text-white">
      <img src="/icons/leaf.webp" alt="" className="absolute -right-6 -top-6 h-28 w-28 opacity-30" />
      <div className="relative flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-bold text-primary">{(user?.name ?? 'U')[0]!.toUpperCase()}</span>
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold">{user?.name || 'Add your name'}</div>
          <div className="text-sm text-white/80">+91 {user?.phone}</div>
          {user?.email && <div className="truncate text-xs text-white/70">{user.email}</div>}
        </div>
        <Link to="/account/profile" className="ml-auto rounded-xl bg-white/15 p-2 transition hover:bg-white/25" aria-label="Edit profile">
          <Pencil size={18} />
        </Link>
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-white/10 py-2">
          <div className="text-lg font-bold">{orders.data?.total ?? '–'}</div>
          <div className="text-[11px] text-white/75">Orders</div>
        </div>
        <div className="rounded-2xl bg-white/10 py-2">
          <div className="text-lg font-bold">{since || '–'}</div>
          <div className="text-[11px] text-white/75">Member since</div>
        </div>
      </div>
    </div>
  );
}

function MenuList() {
  const logout = useConfirmLogout();
  return (
    <Card className="overflow-hidden">
      {MENU.map(({ to, label, icon: Icon, hint }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => clsx('flex items-center gap-3 border-b border-line/60 px-4 py-3.5 transition hover:bg-cream/70', isActive && 'bg-light-green/50')}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream text-primary">
            <Icon size={18} />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-medium text-ink">{label}</span>
            {hint && <span className="block text-xs text-muted">{hint}</span>}
          </span>
          <ChevronRight size={18} className="text-muted" />
        </NavLink>
      ))}
      <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-danger transition hover:bg-danger/5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-danger/10">
          <LogOut size={18} />
        </span>
        <span className="text-sm font-semibold">Log out</span>
      </button>
    </Card>
  );
}

/** Two-pane account area on desktop; on phones the hub is a list and each section is its own page. */
export function AccountShell({ title, children }: { title?: string; children?: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[340px_1fr]">
      <aside className={clsx('space-y-4', children ? 'hidden lg:block' : '')}>
        <ProfileCard />
        <MenuList />
        <p className="text-center text-xs text-muted">Version {APP_VERSION}</p>
      </aside>
      {children && (
        <section className="fade-up min-w-0">
          {title && (
            <div className="mb-4 flex items-center gap-2">
              <button onClick={() => nav('/account')} className="rounded-xl p-1.5 hover:bg-beige lg:hidden" aria-label="Back">
                <ChevronLeft size={22} />
              </button>
              <h1 className="text-xl">{title}</h1>
            </div>
          )}
          {children}
        </section>
      )}
      {!children && (
        <section className="hidden lg:block">
          <EmptyState icon="/icons/heart-leaf.webp" title="Welcome back!" text="Pick something from the menu to manage your account." />
        </section>
      )}
    </div>
  );
}

export function AccountPage() {
  return <AccountShell />;
}

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  useEffect(() => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
  }, [user?.name, user?.email]);
  const dirty = name !== (user?.name ?? '') || email !== (user?.email ?? '');
  const save = useMutation({
    mutationFn: () => api.auth.updateMe({ name: name.trim(), email: email.trim() || null }),
    onSuccess: (u) => {
      setUser(u);
      toast.success('Profile updated');
    },
    onError: (e) => toast.error('Could not save', (e as Error).message),
  });
  return (
    <AccountShell title="Edit profile">
      <Card className="max-w-xl space-y-4 p-6">
        <Field label="Full name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </Field>
        <Field label="Email (optional)" hint="For invoices and important updates">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Mobile number" hint="Your login number. To change it, contact support.">
          <Input value={`+91 ${user?.phone ?? ''}`} disabled />
        </Field>
        <div className="flex gap-2 pt-2">
          <Button loading={save.isPending} disabled={!dirty || !name.trim()} onClick={() => save.mutate()}>
            Save changes
          </Button>
          {dirty && (
            <Button
              variant="ghost"
              onClick={() => {
                setName(user?.name ?? '');
                setEmail(user?.email ?? '');
              }}
            >
              Discard
            </Button>
          )}
        </div>
      </Card>
    </AccountShell>
  );
}

export function AddressesPage() {
  const qc = useQueryClient();
  const addresses = useQuery({ queryKey: qk.addresses, queryFn: api.me.addresses });
  const [editing, setEditing] = useState<Address | null | 'new'>(null);
  const del = useMutation({
    mutationFn: (id: string) => api.me.deleteAddress(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.addresses });
      toast.success('Address deleted');
    },
  });
  return (
    <AccountShell title="Saved addresses">
      <div className="space-y-3">
        <button onClick={() => setEditing('new')} className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-white p-4 text-left font-semibold text-primary transition hover:bg-light-green/40">
          <Plus size={20} /> Add a new address
        </button>
        {addresses.isLoading ? (
          <PageLoader />
        ) : !addresses.data?.length ? (
          <EmptyState icon="/icons/house.webp" title="No saved addresses" text="Add one to check out faster." />
        ) : (
          addresses.data.map((a) => (
            <Card key={a.id} className="flex items-start gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream text-primary">
                <MapPin size={18} />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                  {a.label} {a.isDefault && <Badge tone="green">Default</Badge>} {!a.serviceable && <Badge tone="red">Not serviceable</Badge>}
                </div>
                <div className="mt-0.5 text-muted">
                  {a.name} · {a.phone}
                  <br />
                  {a.line1}
                  {a.landmark ? `, ${a.landmark}` : ''}, {a.city} – {a.pincode}
                </div>
              </div>
              <button onClick={() => setEditing(a)} className="rounded-lg p-2 text-muted hover:bg-beige hover:text-primary" aria-label="Edit">
                <Pencil size={16} />
              </button>
              <button
                onClick={async () =>
                  (await confirm({ title: 'Delete this address?', message: `${a.label}: ${a.line1}`, tone: 'danger', icon: 'delete', confirmText: 'Delete' })) && del.mutate(a.id)
                }
                className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"
                aria-label="Delete"
              >
                <Trash2 size={16} />
              </button>
            </Card>
          ))
        )}
      </div>
      {editing && <AddressForm open onClose={() => setEditing(null)} address={editing === 'new' ? null : editing} />}
    </AccountShell>
  );
}

export function SettingsBlock({ customer }: { customer: boolean }) {
  const { user, setUser } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const logout = useConfirmLogout();
  const update = useMutation({
    mutationFn: (patch: { notifyOrders?: boolean; notifyOffers?: boolean }) => api.auth.updateMe(patch),
    onSuccess: (u) => {
      setUser(u);
      toast.success('Preferences saved');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  async function deleteAccount() {
    const ok = await confirm({
      title: 'Delete your account?',
      message: 'Your profile, saved addresses and cart will be permanently removed. Past invoices are kept for legal reasons. This cannot be undone.',
      tone: 'danger',
      icon: 'delete',
      confirmText: 'Delete forever',
      typeToConfirm: 'DELETE',
    });
    if (!ok) return;
    try {
      await api.auth.deleteAccount();
      await tokenStore.clear();
      qc.clear();
      toast.success('Account deleted', 'We are sorry to see you go.');
      nav('/');
    } catch (e) {
      toast.error('Could not delete account', (e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="mb-1 text-base">Notifications</h2>
        <p className="mb-4 text-xs text-muted">Choose what we send to your phone. In-app notifications are always kept.</p>
        <div className="space-y-4">
          <Row title={customer ? 'Order updates' : 'Work updates'} text={customer ? 'Confirmed, packed, out for delivery, refunds' : 'New orders, assignments and approvals'}>
            <Toggle checked={!!user?.notifyOrders} disabled={update.isPending} onChange={(v) => update.mutate({ notifyOrders: v })} />
          </Row>
          {customer && (
            <Row title="Offers & deals" text="Coupons and seasonal specials">
              <Toggle checked={!!user?.notifyOffers} disabled={update.isPending} onChange={(v) => update.mutate({ notifyOffers: v })} />
            </Row>
          )}
        </div>
      </Card>

      <Card className="p-5 text-sm">
        <h2 className="mb-3 text-base">Account details</h2>
        <dl className="grid grid-cols-[120px_1fr] gap-y-2">
          <dt className="text-muted">Mobile</dt>
          <dd className="text-ink">+91 {user?.phone}</dd>
          <dt className="text-muted">Name</dt>
          <dd className="text-ink">{user?.name || '—'}</dd>
          <dt className="text-muted">Email</dt>
          <dd className="text-ink">{user?.email || '—'}</dd>
          {user?.area && (
            <>
              <dt className="text-muted">Area</dt>
              <dd className="text-ink">{user.area.name}</dd>
            </>
          )}
          <dt className="text-muted">Member since</dt>
          <dd className="text-ink">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</dd>
        </dl>
      </Card>

      <Card className="divide-y divide-line/60 overflow-hidden">
        <button onClick={logout} className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-semibold text-ink hover:bg-cream/60">
          <LogOut size={18} className="text-muted" /> Log out
        </button>
        {customer ? (
          <button onClick={deleteAccount} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-danger/5">
            <Trash2 size={18} className="text-danger" />
            <span>
              <span className="block text-sm font-semibold text-danger">Delete account</span>
              <span className="block text-xs text-muted">Permanently remove your profile and addresses</span>
            </span>
          </button>
        ) : (
          <p className="px-5 py-4 text-xs text-muted">Staff accounts are managed by your area admin. Contact them to change your role or remove access.</p>
        )}
      </Card>
    </div>
  );
}

function Row({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="block text-xs text-muted">{text}</span>
      </span>
      {children}
    </div>
  );
}

export function SettingsPage() {
  return (
    <AccountShell title="Settings">
      <SettingsBlock customer />
    </AccountShell>
  );
}

/** Public pages: guests can read help and policies too. */
export function HelpPage() {
  const { user } = useAuth();
  const inner = <HelpContent />;
  return user?.role === 'CUSTOMER' ? <AccountShell title="Help & support">{inner}</AccountShell> : <div className="mx-auto max-w-3xl">{inner}</div>;
}

export function TermsPage() {
  const { user } = useAuth();
  const inner = <LegalContent doc={TERMS} />;
  return user?.role === 'CUSTOMER' ? <AccountShell title="Terms & conditions">{inner}</AccountShell> : <div className="mx-auto max-w-3xl">{inner}</div>;
}

export function PrivacyPage() {
  const { user } = useAuth();
  const inner = <LegalContent doc={PRIVACY} />;
  return user?.role === 'CUSTOMER' ? <AccountShell title="Privacy policy">{inner}</AccountShell> : <div className="mx-auto max-w-3xl">{inner}</div>;
}

export function AboutPage() {
  const { user } = useAuth();
  const inner = (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-beige to-mint p-8 text-center">
        <img src="/images/logo.png" alt="" className="mx-auto h-24 w-24" />
        <h1 className="mt-3 text-2xl">Sabjii Le Lo</h1>
        <p className="font-script text-2xl text-primary">Fresh from the farm, every morning</p>
      </div>
      <div className="space-y-3 p-6 text-sm text-body/85">
        <p>We buy vegetables and fruits fresh from local mandis and farmers every morning, and deliver them to your door in the slot you choose.</p>
        <p>Our freshness promise is simple: check everything at your door, and hand back anything that isn't fresh. You never pay for what you don't keep.</p>
        <p className="text-muted">
          {SUPPORT.companyName} · {SUPPORT.address} · Version {APP_VERSION}
        </p>
      </div>
    </Card>
  );
  return user?.role === 'CUSTOMER' ? <AccountShell title="About">{inner}</AccountShell> : <div className="mx-auto max-w-3xl">{inner}</div>;
}

export function NotificationsPage({ orderBase = '/orders' }: { orderBase?: string }) {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [...qk.notifications, page], queryFn: () => api.notifications.list(page) });
  const read = useMutation({
    mutationFn: () => api.notifications.markRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.notifications });
      toast.success('All caught up');
    },
  });
  if (q.isLoading) return <PageLoader />;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl">Notifications</h1>
        {!!q.data?.unread && (
          <Button size="sm" variant="secondary" onClick={() => read.mutate()}>
            Mark all read
          </Button>
        )}
      </div>
      {!q.data?.data.length ? (
        <EmptyState icon="/icons/heart.webp" title="All caught up" text="Order updates and offers will appear here." />
      ) : (
        <Card className="divide-y divide-line/70 overflow-hidden">
          {q.data.data.map((n) => {
            const orderId = (n.data as { orderId?: string } | null)?.orderId;
            const body = (
              <div className={clsx('flex gap-3 p-4 transition', n.readAt ? 'hover:bg-cream/50' : 'bg-mint/60 hover:bg-mint')}>
                <span className={clsx('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', n.readAt ? 'bg-cream text-muted' : 'bg-primary text-white')}>
                  <Bell size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink">{n.title}</div>
                  <div className="text-sm text-muted">{n.body}</div>
                  <div className="mt-1 text-xs text-muted/80">{new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                </div>
              </div>
            );
            return orderId ? (
              <Link key={n.id} to={`${orderBase}/${orderId}`} className="block">
                {body}
              </Link>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </Card>
      )}
      {q.data && <Pager page={page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />}
    </div>
  );
}
