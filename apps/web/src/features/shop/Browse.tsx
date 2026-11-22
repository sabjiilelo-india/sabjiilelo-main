import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { qk } from '@sabjiilelo/api-client';
import { formatDateLabel, formatINR } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { useShop } from '../../lib/shop';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui';
import { ProduceImage } from '../../components/ProduceImage';
import { AddToCart, NutritionCard, ProductGrid, ProductGridSkeleton, discountPct } from './components';

export function CategoryPage() {
  const { id } = useParams();
  const { area } = useShop();
  const home = useQuery({ queryKey: qk.catalogHome(area?.id ?? ''), queryFn: () => api.catalog.home(area!.id), enabled: !!area });
  const items = useQuery({ queryKey: qk.catalogItems(area?.id ?? '', { categoryId: id }), queryFn: () => api.catalog.items(area!.id, { categoryId: id }), enabled: !!area });
  const cat = home.data?.categories.find((c) => c.id === id);

  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <aside className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
        {home.data?.categories.map((c) => (
          <Link
            key={c.id}
            to={`/category/${c.id}`}
            className={clsx('whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition', c.id === id ? 'bg-primary text-white' : 'bg-white text-body hover:bg-light-green')}
          >
            {c.name}
          </Link>
        ))}
      </aside>
      <div>
        <h1 className="mb-1 text-xl">{cat?.name ?? 'Category'}</h1>
        {items.data && <p className="mb-4 text-xs text-muted">{items.data.items.length} items · for delivery {formatDateLabel(items.data.date).toLowerCase()}</p>}
        {items.error ? (
          <ErrorState error={items.error} onRetry={() => items.refetch()} />
        ) : items.isLoading ? (
          <ProductGridSkeleton />
        ) : items.data?.items.length ? (
          <ProductGrid items={items.data.items} />
        ) : (
          <EmptyState title="Nothing here yet" text="We're adding fresh items to this category soon." />
        )}
      </div>
    </div>
  );
}

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const { area } = useShop();
  const items = useQuery({ queryKey: qk.catalogItems(area?.id ?? '', { q }), queryFn: () => api.catalog.items(area!.id, { q }), enabled: !!area && !!q });
  return (
    <div>
      <h1 className="mb-4 text-xl">Results for “{q}”</h1>
      {items.isLoading ? (
        <ProductGridSkeleton />
      ) : items.data?.items.length ? (
        <ProductGrid items={items.data.items} />
      ) : (
        <EmptyState title="No matches" text="Try a different name — e.g. 'aloo', 'tomato' or 'apple'." />
      )}
    </div>
  );
}

export function ItemPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const q = useQuery({ queryKey: qk.catalogItem(id!), queryFn: () => api.catalog.item(id!) });
  const [pick, setPick] = useState(0);
  if (q.isLoading) return <ItemSkeleton />;
  if (q.error || !q.data) return <ErrorState error={q.error} />;
  const { item, date } = q.data;
  const sticky = item.variants[pick] ?? item.variants[0];
  return (
    <div className="pb-20 md:pb-0">
      <button onClick={() => nav(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-primary">
        <ArrowLeft size={16} /> Back
      </button>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="card overflow-hidden md:sticky md:top-24 md:self-start">
          <ProduceImage src={item.images[0]} name={item.name} className="aspect-square w-full" emojiClass="text-[120px]" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl">{item.name}</h1>
          {item.sourceNote && <p className="mt-2 inline-block rounded-lg bg-light-green px-2.5 py-1 text-sm text-primary">🌱 {item.sourceNote}</p>}
          <p className="mt-4 text-body/90">{item.description}</p>
          <p className="mt-2 text-xs text-muted">Availability for delivery {formatDateLabel(date).toLowerCase()}</p>
          <div className="mt-6 space-y-3">
            {item.variants.map((v, vi) => {
              const off = discountPct(v);
              return (
                <div key={v.id} onClick={() => setPick(vi)} className={`card flex items-center justify-between p-4 transition ${vi === pick ? 'border-primary/50 ring-1 ring-primary/30' : ''}`}>
                  <div>
                    <div className="font-semibold text-ink">{v.label}</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-semibold text-primary">{formatINR(v.pricePaise)}</span>
                      {off > 0 && (
                        <>
                          <span className="text-sm text-muted line-through">{formatINR(v.mrpPaise)}</span>
                          <span className="text-xs font-semibold text-accent">{off}% off</span>
                        </>
                      )}
                    </div>
                  </div>
                  <AddToCart variant={v} item={item} />
                </div>
              );
            })}
          </div>
          {item.nutrition && <NutritionCard nutrition={item.nutrition} />}
          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-mint p-4 text-sm">
            <ShieldCheck className="shrink-0 text-primary" />
            <span>
              <b className="text-ink">Freshness promise.</b> Open the box at your door — if it isn't fresh, hand it back to our delivery partner and it's off your bill. You can even cancel the whole order until it's handed over.
            </span>
          </div>
        </div>
      </div>
      {sticky && (
        <div className="fixed inset-x-0 bottom-[60px] z-20 flex items-center justify-between gap-3 border-t border-line bg-white/95 px-4 py-2.5 shadow-lift backdrop-blur md:hidden">
          <div className="min-w-0">
            <div className="truncate text-xs text-muted">{item.name} · {sticky.label}</div>
            <div className="text-lg font-bold text-primary">{formatINR(sticky.pricePaise)}</div>
          </div>
          <AddToCart variant={sticky} item={item} />
        </div>
      )}
    </div>
  );
}

function ItemSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-2" aria-busy="true">
      <div className="skeleton aspect-square" />
      <div className="space-y-4">
        <div className="skeleton h-9 w-2/3" />
        <div className="skeleton h-5 w-1/3" />
        <div className="skeleton h-20" />
        <div className="skeleton h-16" />
        <div className="skeleton h-16" />
      </div>
    </div>
  );
}

