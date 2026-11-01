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
    <div className={clsx('flex items-center justify-between rounded-xl bg-primary text-white shadow-sm', size === 'sm' ? 'h-9 w-[84px]' : 'h-10 w-28')}>
      <button type="button" className="flex h-full w-8 items-center justify-center rounded-l-xl transition hover:bg-dark-green" onClick={() => onChange(qty - 1)} aria-label="Decrease">
        <Minus size={size === 'sm' ? 14 : 16} strokeWidth={2.5} />
      </button>
      <span key={qty} className="animate-pop text-sm font-bold">
        {qty}
      </span>
      <button
        type="button"
        className="flex h-full w-8 items-center justify-center rounded-r-xl transition hover:bg-dark-green disabled:opacity-40"
        disabled={qty >= max}
        onClick={() => {
          if (qty >= max) return;
          onChange(qty + 1);
        }}
        aria-label="Increase"
      >
        <Plus size={size === 'sm' ? 14 : 16} strokeWidth={2.5} />
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
    if (!user) {
      toast.info('Log in to start shopping', 'It takes 10 seconds with your mobile number.');
      return nav(`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`);
    }
    if (user.role !== 'CUSTOMER') return toast.warning('Staff accounts cannot order', 'Use a customer number to shop.');
    setQty(variant.id, 1);
  }

  if (soldOut && qty === 0) {
    return <span className={clsx('flex items-center justify-center rounded-xl bg-beige text-xs font-semibold text-muted', size === 'sm' ? 'h-9 w-[84px]' : 'h-10 w-28')}>Sold out</span>;
  }
  if (qty > 0)
    return (
      <Stepper
        qty={qty}
        onChange={(q) => {
          if (q > maxByStock) return toast.warning('That is all we have for this slot');
          setQty(variant.id, q);
        }}
        size={size}
        max={Math.min(50, maxByStock)}
      />
    );
  return (
    <button
      type="button"
      onClick={add}
      className={clsx(
        'rounded-xl border-[1.5px] border-primary bg-light-green/40 font-bold uppercase tracking-wide text-primary transition hover:bg-primary hover:text-white active:scale-95',
        size === 'sm' ? 'h-9 w-[84px] text-xs' : 'h-10 w-28 text-sm',
      )}
    >
      Add
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
  const soldOut = item.remainingQty < Math.min(...item.variants.map((x) => x.baseQty));
  return (
    <div className={clsx('group flex flex-col rounded-2xl border border-line/70 bg-white p-2.5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card', soldOut && 'opacity-60')}>
      <Link to={`/item/${item.id}`} className="relative block overflow-hidden rounded-xl">
        <ProduceImage src={item.images[0]} name={item.name} className="aspect-[5/4] w-full transition duration-300 group-hover:scale-105" emojiClass="text-5xl" />
        {off > 0 && (
          <span className="absolute left-0 top-0 rounded-br-xl bg-accent px-2 py-1 text-[10px] font-bold leading-none text-white">
            {off}%
            <br />
            OFF
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col px-0.5 pt-2">
        {item.sourceNote ? (
          <span className="mb-1 inline-flex w-fit max-w-full items-center gap-1 truncate rounded-md bg-mint px-1.5 py-0.5 text-[10px] font-medium text-primary">🌱 {item.sourceNote}</span>
        ) : (
          <span className="mb-1 inline-flex w-fit items-center rounded-md bg-beige/70 px-1.5 py-0.5 text-[10px] font-medium text-muted">Fresh today</span>
        )}
        <Link to={`/item/${item.id}`} className="line-clamp-2 min-h-[2.4rem] text-[13px] font-semibold leading-tight text-ink hover:text-primary">
          {item.name}
        </Link>
        {item.variants.length > 1 ? (
          <div className="no-scrollbar mt-1.5 flex gap-1 overflow-x-auto">
            {item.variants.map((x, i) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setVi(i)}
                className={clsx('shrink-0 rounded-lg border px-1.5 py-0.5 text-[11px] font-medium transition', i === vi ? 'border-primary bg-light-green text-primary' : 'border-line text-muted hover:border-primary/40')}
              >
                {x.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="mt-1.5 text-xs text-muted">{v.label}</span>
        )}
        <div className="mt-auto flex items-end justify-between gap-1.5 pt-3">
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-ink">{formatINR(v.pricePaise)}</div>
            {off > 0 && <div className="text-[11px] text-muted line-through">{formatINR(v.mrpPaise)}</div>}
          </div>
          <AddToCart variant={v} item={item} size="sm" />
        </div>
      </div>
    </div>
  );
}

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

export function ProductGridSkeleton({ n = 12 }: { n?: number }) {
  return (
    <div className={GRID}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="rounded-2xl border border-line/70 bg-white p-2.5">
          <div className="skeleton aspect-[5/4]" />
          <div className="mt-3 space-y-2">
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-4 w-4/5" />
            <div className="flex justify-between pt-2">
              <div className="skeleton h-6 w-12" />
              <div className="skeleton h-9 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductGrid({ items }: { items: CatalogItem[] }) {
  return (
    <div className={GRID}>
      {items.map((i, idx) => (
        <div key={i.id} className="fade-up" style={{ animationDelay: `${Math.min(idx, 12) * 25}ms` }}>
          <ProductCard item={i} />
        </div>
      ))}
    </div>
  );
}
