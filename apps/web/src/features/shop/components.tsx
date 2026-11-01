import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';
import clsx from 'clsx';
import { formatINR, type CatalogItem, type Variant } from '@sabjiilelo/shared';
import { useAuth } from '../../lib/auth';
import { useCart } from '../../lib/shop';
import { ProduceImage } from '../../components/ProduceImage';
import { toast } from '../../components/toast';

export function Stepper({ qty, onChange, size = 'md', max = 50 }: { qty: number; onChange: (q: number) => void; size?: 'sm' | 'md'; max?: number }) {
  return (
    <div className={clsx('flex items-center justify-between rounded-xl bg-primary text-white shadow-sm', size === 'sm' ? 'h-8 w-[88px]' : 'h-10 w-28')}>
      <button type="button" className="flex h-full w-8 items-center justify-center rounded-l-xl hover:bg-dark-green" onClick={() => onChange(qty - 1)} aria-label="Decrease">
        <Minus size={size === 'sm' ? 14 : 16} />
      </button>
      <span key={qty} className="animate-pop text-sm font-semibold">
        {qty}
      </span>
      <button
        type="button"
        className="flex h-full w-8 items-center justify-center rounded-r-xl hover:bg-dark-green disabled:opacity-40"
        disabled={qty >= max}
        onClick={() => onChange(qty + 1)}
        aria-label="Increase"
      >
        <Plus size={size === 'sm' ? 14 : 16} />
      </button>
    </div>
  );
}

/** Add-to-cart control. Guests are sent to login and brought back. */
export function AddToCart({ variant, item, size = 'md' }: { variant: Variant; item: CatalogItem; size?: 'sm' | 'md' }) {
  const { user } = useAuth();
  const { qtyOf, setQty } = useCart();
  const nav = useNavigate();
  const loc = useLocation();
  const qty = qtyOf(variant.id);
  const maxByStock = Math.floor(item.remainingQty / variant.baseQty);
  const soldOut = maxByStock <= 0;

  function add() {
    if (!user) return nav(`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`);
    if (user.role !== 'CUSTOMER') return toast.info('Staff accounts cannot place orders. Use a customer number.');
    setQty(variant.id, 1);
  }

  if (soldOut && qty === 0) {
    return <span className={clsx('flex items-center justify-center rounded-xl bg-beige text-xs font-medium text-muted', size === 'sm' ? 'h-8 w-[88px]' : 'h-10 w-28')}>Sold out</span>;
  }
  if (qty > 0) return <Stepper qty={qty} onChange={(q) => setQty(variant.id, q)} size={size} max={Math.min(50, maxByStock)} />;
  return (
    <button
      type="button"
      onClick={add}
      className={clsx(
        'rounded-xl border-2 border-primary bg-white font-semibold text-primary shadow-sm transition hover:bg-light-green active:scale-95',
        size === 'sm' ? 'h-8 w-[88px] text-xs' : 'h-10 w-28 text-sm',
      )}
    >
      ADD
    </button>
  );
}

export function discountPct(v: Variant) {
  return v.mrpPaise > v.pricePaise ? Math.round(((v.mrpPaise - v.pricePaise) / v.mrpPaise) * 100) : 0;
}

export function ProductCard({ item }: { item: CatalogItem }) {
  const [vi, setVi] = useState(0);
  const v = item.variants[vi] ?? item.variants[0]!;
  const off = discountPct(v);
  const soldOut = item.remainingQty < (item.variants.reduce((m, x) => Math.min(m, x.baseQty), Infinity) || 1);
  return (
    <div className={clsx('card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift', soldOut && 'opacity-70')}>
      <Link to={`/item/${item.id}`} className="relative block">
        <ProduceImage src={item.images[0]} name={item.name} className="aspect-square w-full transition group-hover:scale-[1.03]" emojiClass="text-6xl" />
        {off > 0 && <span className="absolute left-2 top-2 rounded-lg bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">{off}% OFF</span>}
        {item.sourceNote && <span className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-lg bg-white/90 px-2 py-0.5 text-[10px] font-medium text-primary">🌱 {item.sourceNote}</span>}
      </Link>
      <div className="flex flex-1 flex-col p-3">
        <Link to={`/item/${item.id}`} className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-ink hover:text-primary">
          {item.name}
        </Link>
        {item.variants.length > 1 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.variants.map((x, i) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setVi(i)}
                className={clsx('rounded-lg border px-2 py-0.5 text-[11px] font-medium transition', i === vi ? 'border-primary bg-light-green text-primary' : 'border-line text-muted hover:border-primary/50')}
              >
                {x.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="mt-2 text-xs text-muted">{v.label}</span>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div>
            <div className="font-semibold text-ink">{formatINR(v.pricePaise)}</div>
            {off > 0 && <div className="text-xs text-muted line-through">{formatINR(v.mrpPaise)}</div>}
          </div>
          <AddToCart variant={v} item={item} size="sm" />
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ n = 8 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="skeleton aspect-square rounded-none" />
          <div className="space-y-2 p-3">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductGrid({ items }: { items: CatalogItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((i) => (
        <ProductCard key={i.id} item={i} />
      ))}
    </div>
  );
}
