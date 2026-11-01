import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Home, LayoutDashboard, MapPin, Package, Search, ShoppingBag, User } from 'lucide-react';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { formatINR } from '@sabjiilelo/shared';
import { useAuth, homeFor } from '../lib/auth';
import { useCart, useShop } from '../lib/shop';
import { api } from '../lib/api';
import { LocationModal } from '../components/LocationModal';

export function ShopLayout() {
  const { user } = useAuth();
  const { area, pincode } = useShop();
  const { cart } = useCart();
  const [locOpen, setLocOpen] = useState(false);
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const loc = useLocation();
  const isCustomer = user?.role === 'CUSTOMER';
  const unread = useQuery({ queryKey: qk.notifications, queryFn: () => api.notifications.list(), enabled: isCustomer, refetchInterval: 60_000 });

  useEffect(() => {
    if (!area) setLocOpen(true);
  }, [area]);
  useEffect(() => window.scrollTo(0, 0), [loc.pathname]);

  const showCartBar = cart.itemCount > 0 && !['/cart', '/checkout'].includes(loc.pathname);

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="shrink-0">
            <img src="/images/logo-full.webp" alt="Sabjii Le Lo" className="h-10 w-auto" />
          </Link>
          <button onClick={() => setLocOpen(true)} className="flex min-w-0 items-center gap-1.5 rounded-xl px-2 py-1.5 text-left hover:bg-beige/70">
            <MapPin size={18} className="shrink-0 text-accent" />
            <span className="min-w-0">
              <span className="block text-[11px] leading-tight text-muted">Deliver to</span>
              <span className="flex items-center gap-0.5 truncate text-sm font-semibold text-ink">
                {area ? `${area.name} ${pincode ?? ''}` : 'Set location'} <ChevronDown size={14} />
              </span>
            </span>
          </button>
          <form
            className="relative ml-auto hidden max-w-md flex-1 md:block"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input rounded-full pl-10" placeholder="Search tomato, apple, palak…" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <div className="ml-auto flex items-center gap-1 md:ml-2">
            {isCustomer && (
              <Link to="/notifications" className="relative rounded-xl p-2 hover:bg-beige/70" aria-label="Notifications">
                <Bell size={20} />
                {!!unread.data?.unread && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />}
              </Link>
            )}
            {user && !isCustomer ? (
              <Link to={homeFor(user.role)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-primary hover:bg-light-green">
                <LayoutDashboard size={18} /> Portal
              </Link>
            ) : user ? (
              <Link to="/account" className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-beige/70 md:flex">
                <User size={18} /> {user.name?.split(' ')[0] ?? 'Account'}
              </Link>
            ) : (
              <Link to={`/login?next=${encodeURIComponent(loc.pathname)}`} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-dark-green">
                Login
              </Link>
            )}
            <Link to="/cart" className="relative hidden items-center gap-2 rounded-xl bg-light-green px-3 py-2 text-sm font-semibold text-primary md:flex">
              <ShoppingBag size={18} />
              {cart.itemCount > 0 ? formatINR(cart.subtotalPaise) : 'Cart'}
              {cart.itemCount > 0 && (
                <span key={cart.itemCount} className="animate-pop absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] text-white">
                  {cart.itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
        <form
          className="relative px-4 pb-3 md:hidden"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <Search size={18} className="absolute left-7 top-1/2 -translate-y-[calc(50%+6px)] text-muted" />
          <input className="input rounded-full pl-10" placeholder="Search fresh vegetables & fruits" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        <Outlet />
      </main>

      <footer className="no-print mt-10 hidden border-t border-line bg-beige/50 md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-sm text-muted">
          <span className="font-script text-2xl text-primary">Fresh from the farm, every morning</span>
          <span>© {new Date().getFullYear()} Sabjii Le Lo</span>
        </div>
      </footer>

      {showCartBar && (
        <Link
          to="/cart"
          className="fixed inset-x-3 bottom-[72px] z-30 flex items-center justify-between rounded-2xl bg-primary px-4 py-3 text-white shadow-lift md:bottom-6 md:left-auto md:right-6 md:w-80"
        >
          <span>
            <span className="block text-xs text-white/80">{cart.itemCount} item{cart.itemCount > 1 ? 's' : ''}</span>
            <span className="font-semibold">{formatINR(cart.subtotalPaise)}</span>
          </span>
          <span className="flex items-center gap-1.5 font-semibold">
            View cart <ShoppingBag size={18} />
          </span>
        </Link>
      )}

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {[
          { to: '/', label: 'Home', icon: Home, end: true },
          { to: '/cart', label: 'Cart', icon: ShoppingBag, badge: cart.itemCount },
          { to: '/orders', label: 'Orders', icon: Package },
          { to: user ? '/account' : '/login', label: 'Account', icon: User },
        ].map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink key={label} to={to} end={end} className={({ isActive }) => clsx('relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-primary' : 'text-muted')}>
            <Icon size={22} />
            {label}
            {!!badge && <span className="absolute right-[calc(50%-20px)] top-1 rounded-full bg-accent px-1.5 text-[10px] text-white">{badge}</span>}
          </NavLink>
        ))}
      </nav>

      <LocationModal open={locOpen} onClose={() => setLocOpen(false)} />
    </div>
  );
}
