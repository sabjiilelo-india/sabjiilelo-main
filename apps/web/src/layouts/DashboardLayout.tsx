import { useEffect, useState, type ComponentType } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Banknote,
  Bell,
  Boxes,
  ClipboardList,
  FileBarChart,
  Globe2,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareWarning,
  Package,
  PackageCheck,
  Receipt,
  RotateCcw,
  Settings,
  ShoppingBasket,
  Star,
  Store,
  Tag,
  Tags,
  Timer,
  Truck,
  Users,
  Image,
  IndianRupee,
  ShieldCheck,
  Wallet,
  X,
  type LucideProps,
} from 'lucide-react';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { can, ROLE_LABEL, type Permission, type Role } from '@sabjiilelo/shared';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';

type Item = { to: string; label: string; icon: ComponentType<LucideProps>; perm?: Permission; roles?: Role[]; end?: boolean };
type Group = { title: string; items: Item[] };

const SUPER_NAV: Group[] = [
  {
    title: 'Super admin',
    items: [
      { to: '/admin/overview', label: 'Overview', icon: Globe2 },
      { to: '/admin/areas', label: 'Areas', icon: Store },
      { to: '/admin/admins', label: 'Area admins', icon: ShieldCheck },
    ],
  },
];

const STAFF_NAV: Group[] = [
  {
    title: 'Today',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER'], end: true },
      { to: '/dashboard/orders', label: 'Orders', icon: Package, perm: 'viewOrders' },
      { to: '/dashboard/picklist', label: 'Pick list', icon: ClipboardList, perm: 'operateOrders' },
      { to: '/dashboard/dispatch', label: 'Dispatch', icon: Truck, perm: 'operateOrders' },
      { to: '/dashboard/pos', label: 'Counter POS', icon: Receipt, perm: 'pos' },
    ],
  },
  {
    title: 'Store',
    items: [
      { to: '/dashboard/stock', label: 'Daily stock', icon: Boxes, perm: 'managePriceStock' },
      { to: '/dashboard/prices', label: 'Price board', icon: IndianRupee, perm: 'managePriceStock' },
      { to: '/dashboard/catalog', label: 'Items', icon: ShoppingBasket, perm: 'manageCatalog' },
      { to: '/dashboard/categories', label: 'Categories', icon: Tags, perm: 'manageCatalog' },
      { to: '/dashboard/slots', label: 'Delivery slots', icon: Timer, perm: 'manageSlots' },
      { to: '/dashboard/coupons', label: 'Coupons', icon: Tag, perm: 'manageCoupons' },
      { to: '/dashboard/banners', label: 'Banners', icon: Image, perm: 'manageBanners' },
    ],
  },
  {
    title: 'Supply',
    items: [
      { to: '/dashboard/supply/demand', label: 'Demand', icon: FileBarChart, perm: 'supply' },
      { to: '/dashboard/supply/pos', label: 'Purchase orders', icon: PackageCheck, perm: 'supply' },
    ],
  },
  {
    title: 'Accounts',
    items: [
      { to: '/dashboard/accounts/cod', label: 'COD cash', icon: Banknote, perm: 'accounts' },
      { to: '/dashboard/accounts/vendors', label: 'Vendor payouts', icon: Wallet, perm: 'accounts' },
      { to: '/dashboard/accounts/refunds', label: 'Refunds', icon: RotateCcw, perm: 'accounts' },
      { to: '/dashboard/accounts/issues', label: 'Customer issues', icon: MessageSquareWarning, perm: 'accounts' },
      { to: '/dashboard/reports', label: 'Reports', icon: FileBarChart, perm: 'reports' },
      { to: '/dashboard/feedback', label: 'Ratings', icon: Star, perm: 'viewFeedback' },
    ],
  },
  {
    title: 'Team',
    items: [
      { to: '/dashboard/staff', label: 'Staff', icon: Users, perm: 'manageStaff' },
      { to: '/dashboard/hr', label: 'HR', icon: Users, roles: ['HR'] },
      { to: '/dashboard/settings', label: 'Area settings', icon: Settings, perm: 'manageAreaSettings' },
    ],
  },
  {
    title: 'Deliveries',
    items: [{ to: '/dashboard/deliveries', label: 'My deliveries', icon: Truck, perm: 'deliver' }],
  },
  {
    title: 'Supplier',
    items: [
      { to: '/dashboard/vendor/orders', label: 'Purchase orders', icon: PackageCheck, perm: 'vendorPortal' },
      { to: '/dashboard/vendor/rates', label: "Today's rates", icon: IndianRupee, perm: 'vendorPortal' },
      { to: '/dashboard/vendor/ledger', label: 'Payments', icon: Wallet, perm: 'vendorPortal' },
    ],
  },
];

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);
  const notes = useQuery({ queryKey: qk.notifications, queryFn: () => api.notifications.list(), enabled: user?.role !== 'SUPERADMIN', refetchInterval: 60_000 });

  if (!user) return null;
  const groups = (user.role === 'SUPERADMIN' ? SUPER_NAV : STAFF_NAV)
    .map((g) => ({ ...g, items: g.items.filter((i) => (i.perm ? can(user.role, i.perm) : i.roles ? i.roles.includes(user.role) : true)) }))
    .filter((g) => g.items.length);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <Link to="/">
          <img src="/images/logo-full.webp" alt="Sabjii Le Lo" className="h-10" />
        </Link>
        <button className="rounded-lg p-1 text-muted lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X size={20} />
        </button>
      </div>
      <div className="mx-4 mb-4 rounded-xl bg-light-green/70 px-3 py-2.5">
        <div className="text-xs text-muted">{ROLE_LABEL[user.role]}</div>
        <div className="truncate text-sm font-semibold text-primary">{user.area ? `${user.area.name} · ${user.area.code}` : 'All areas'}</div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted/80">{g.title}</div>
            {g.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition', isActive ? 'bg-primary text-white shadow-sm' : 'text-body hover:bg-beige/70')
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line bg-white lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 bg-ink/40 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-72 bg-white shadow-lift" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}
      <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-cream/90 px-4 backdrop-blur lg:px-8">
        <button className="rounded-lg p-2 hover:bg-beige lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu size={22} />
        </button>
        <div className="font-script text-2xl text-primary">Namaste, {user.name?.split(' ')[0] ?? ROLE_LABEL[user.role]}</div>
        <div className="ml-auto flex items-center gap-1">
          {user.role !== 'SUPERADMIN' && (
            <Link to="/dashboard/notifications" className="relative rounded-xl p-2 hover:bg-beige/70" aria-label="Notifications">
              <Bell size={20} />
              {!!notes.data?.unread && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] text-white">{notes.data.unread}</span>
              )}
            </Link>
          )}
          <button onClick={logout} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted hover:bg-beige/70 hover:text-danger">
            <LogOut size={18} /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
