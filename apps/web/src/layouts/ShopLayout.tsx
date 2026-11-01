import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Home, LayoutDashboard, LayoutGrid, MapPin, Mail, MessageCircle, Package, Phone, Search, ShoppingBag, User } from 'lucide-react';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { SUPPORT, formatINR } from '@sabjiilelo/shared';
import { useAuth, homeFor } from '../lib/auth';
import { useCart, useShop } from '../lib/shop';
import { api } from '../lib/api';
import { LocationModal } from '../components/LocationModal';
import { Brand } from '../components/Brand';

export function ShopLayout() {
  const { user, status } = useAuth();
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
  // Block body on purpose: newer Chrome returns a Promise from scrollTo, which React would treat as a cleanup.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  useEffect(() => {
    if (loc.pathname !== '/search') setQ('');
  }, [loc.pathname]);

  const showCartBar = cart.itemCount > 0 && !['/cart', '/checkout'].includes(loc.pathname) && !loc.pathname.startsWith('/account');
  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="flex min-h-screen flex-col pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center gap-2 px-4 sm:gap-4">
          <Brand className="hidden sm:flex" />
          <Brand compact className="sm:hidden" />
          <button onClick={() => setLocOpen(true)} className="flex min-w-0 items-center gap-2 rounded-2xl px-2 py-1.5 text-left transition hover:bg-white/70">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <MapPin size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-medium leading-tight text-muted">Delivering to</span>
              <span className="flex items-center gap-0.5 truncate text-sm font-semibold text-ink">
                <span className="truncate">{area ? `${area.name} · ${pincode ?? ''}` : 'Set location'}</span> <ChevronDown size={14} className="shrink-0" />
              </span>
            </span>
          </button>
          <form className="relative mx-auto hidden max-w-xl flex-1 md:block" onSubmit={search}>
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input h-11 rounded-2xl border-transparent bg-white pl-11 shadow-sm" placeholder='Search "tomato", "apple", "palak"…' value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            {isCustomer && (
              <Link to="/notifications" className="relative rounded-xl p-2.5 text-ink transition hover:bg-white/70" aria-label="Notifications">
                <Bell size={20} />
                {!!unread.data?.unread && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-cream bg-accent" />}
              </Link>
            )}
            {status === 'loading' ? (
              <span className="skeleton h-10 w-24 rounded-xl" />
            ) : user && !isCustomer ? (
              <Link to={homeFor(user.role)} className="flex items-center gap-1.5 rounded-xl bg-light-green px-3 py-2 text-sm font-semibold text-primary hover:bg-light-green/70">
                <LayoutDashboard size={18} /> <span className="hidden sm:inline">My portal</span>
              </Link>
            ) : user ? (
              <Link to="/account" className="hidden items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-medium transition hover:bg-white/70 md:flex">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{(user.name ?? 'U')[0]!.toUpperCase()}</span>
                {user.name?.split(' ')[0] ?? 'Account'}
              </Link>
            ) : (
              <Link to={`/login?next=${encodeURIComponent(loc.pathname)}`} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-dark-green">
                Login
              </Link>
            )}
            <Link to="/cart" className="relative ml-1 hidden h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-dark-green md:flex">
              <ShoppingBag size={18} />
              {cart.itemCount > 0 ? (
                <span className="leading-tight">
                  <span className="block text-[10px] font-medium text-white/75">{cart.itemCount} items</span>
                  {formatINR(cart.subtotalPaise)}
                </span>
              ) : (
                'My cart'
              )}
            </Link>
          </div>
        </div>
        <form className="relative px-4 pb-3 md:hidden" onSubmit={search}>
          <Search size={18} className="absolute left-8 top-[22px] -translate-y-1/2 text-muted" />
          <input className="input h-11 rounded-2xl border-transparent bg-white pl-11 shadow-sm" placeholder="Search fresh vegetables & fruits" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
        <Outlet />
      </main>

      <footer className="no-print mt-12 hidden border-t border-line bg-white md:block">
        <div className="mx-auto grid max-w-7xl grid-cols-4 gap-8 px-4 py-10 text-sm">
          <div className="col-span-1">
            <Brand />
            <p className="mt-3 text-muted">Vegetables & fruits bought fresh from the mandi every morning and delivered in your slot.</p>
          </div>
          <div>
            <h4 className="mb-3 text-sm">Shop</h4>
            <ul className="space-y-2 text-muted">
              <li><Link className="hover:text-primary" to="/">Home</Link></li>
              <li><Link className="hover:text-primary" to="/orders">My orders</Link></li>
              <li><Link className="hover:text-primary" to="/account">My account</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm">Help</h4>
            <ul className="space-y-2 text-muted">
              <li><Link className="hover:text-primary" to="/help">Help & FAQs</Link></li>
              <li><Link className="hover:text-primary" to="/terms">Terms & Conditions</Link></li>
              <li><Link className="hover:text-primary" to="/privacy">Privacy Policy</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm">Contact</h4>
            <ul className="space-y-2 text-muted">
              <li className="flex items-center gap-2"><Phone size={14} /> <a href={SUPPORT.phoneHref} className="hover:text-primary">{SUPPORT.phone}</a></li>
              <li className="flex items-center gap-2"><MessageCircle size={14} /> <a href={`https://wa.me/${SUPPORT.whatsapp}`} target="_blank" rel="noreferrer" className="hover:text-primary">WhatsApp us</a></li>
              <li className="flex items-center gap-2"><Mail size={14} /> <a href={`mailto:${SUPPORT.email}`} className="hover:text-primary">{SUPPORT.email}</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line py-4 text-center text-xs text-muted">
          © {new Date().getFullYear()} Sabjii Le Lo · <span className="font-script text-base text-primary">Sabjii le lo, taaza le lo!</span>
        </div>
      </footer>

      {showCartBar && (
        <Link
          to="/cart"
          className="fade-up fixed inset-x-3 bottom-[76px] z-30 flex items-center justify-between rounded-2xl bg-primary px-4 py-3 text-white shadow-lift md:hidden"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <ShoppingBag size={18} />
            </span>
            <span>
              <span className="block text-xs text-white/80">
                {cart.itemCount} item{cart.itemCount > 1 ? 's' : ''}
              </span>
              <span className="font-semibold">{formatINR(cart.subtotalPaise)}</span>
            </span>
          </span>
          <span className="font-semibold">View cart ›</span>
        </Link>
      )}

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {[
          { to: '/', label: 'Home', icon: Home, end: true },
          { to: '/categories', label: 'Categories', icon: LayoutGrid },
          { to: '/cart', label: 'Cart', icon: ShoppingBag, badge: cart.itemCount },
          { to: '/orders', label: 'Orders', icon: Package },
          { to: user ? '/account' : '/login', label: 'Account', icon: User },
        ].map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink key={label} to={to} end={end} className={({ isActive }) => clsx('relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition', isActive ? 'text-primary' : 'text-muted')}>
            {({ isActive }) => (
              <>
                <span className={clsx('flex h-8 w-12 items-center justify-center rounded-full transition', isActive && 'bg-light-green')}>
                  <Icon size={20} />
                </span>
                {label}
                {!!badge && <span className="absolute right-[calc(50%-22px)] top-1 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white">{badge}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <LocationModal open={locOpen} onClose={() => setLocOpen(false)} />
    </div>
  );
}
