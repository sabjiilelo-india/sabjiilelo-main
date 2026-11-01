import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Clock, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { qk } from '@sabjiilelo/api-client';
import { formatDateLabel, formatINR, formatTime12, produceEmoji, type Category } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { useShop } from '../../lib/shop';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui';
import { ProductGrid, ProductGridSkeleton } from './components';

export const CATEGORY_ICON: Record<string, string> = {
  'Fresh Vegetables': '🥕',
  'Leafy & Herbs': '🌿',
  'Fresh Fruits': '🍎',
  Exotic: '🥦',
  'Daily Essentials': '🥥',
};
const CATEGORY_BG = ['bg-[#fdebd3]', 'bg-[#e3f4e1]', 'bg-[#fbe3e3]', 'bg-[#e3f0fb]', 'bg-[#f5ebd7]', 'bg-[#efe5fb]'];

export function CategoryTile({ c, i }: { c: Category; i: number }) {
  return (
    <Link to={`/category/${c.id}`} className="group flex w-[84px] shrink-0 flex-col items-center gap-2 text-center sm:w-auto">
      <span className={`flex h-[76px] w-[76px] items-center justify-center rounded-3xl ${CATEGORY_BG[i % CATEGORY_BG.length]} transition group-hover:-translate-y-1 group-hover:shadow-card sm:h-24 sm:w-24`}>
        {c.imageUrl ? <img src={c.imageUrl} alt="" className="h-14 w-14 rounded-2xl object-cover sm:h-16 sm:w-16" /> : <span className="text-4xl transition group-hover:scale-110 sm:text-5xl">{CATEGORY_ICON[c.name] ?? produceEmoji(c.name)}</span>}
      </span>
      <span className="text-xs font-semibold leading-tight text-ink sm:text-sm">{c.name}</span>
    </Link>
  );
}

export function Home() {
  const { area } = useShop();
  const home = useQuery({ queryKey: qk.catalogHome(area?.id ?? ''), queryFn: () => api.catalog.home(area!.id), enabled: !!area });
  const [slide, setSlide] = useState(0);
  const banners = home.data?.banners ?? [];
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (!area) {
    return <EmptyState icon="/icons/basket.webp" title="Set your delivery location" text="Tell us your pincode to see what's fresh near you today." />;
  }
  if (home.error) return <ErrorState error={home.error} onRetry={() => home.refetch()} />;
  const d = home.data;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-primary via-dark-green to-deep text-white shadow-lift">
        {banners.map((b, i) => (
          <img key={b.id} src={b.imageUrl} alt="" className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === slide ? 'opacity-45' : 'opacity-0'}`} />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-deep/80 via-deep/40 to-transparent" />
        <div className="relative grid gap-6 p-6 sm:p-10 md:grid-cols-[1.5fr_1fr] md:items-center">
          <div>
            {d?.nextSlot ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
                <Clock size={14} />
                Next delivery: {formatDateLabel(d.nextSlot.date)}, {formatTime12(d.nextSlot.startTime)}–{formatTime12(d.nextSlot.endTime)}
              </span>
            ) : (
              <Skeleton className="h-6 w-64 bg-white/20" />
            )}
            <h1 key={slide} className="fade-up mt-4 text-3xl font-bold leading-tight text-white sm:text-[42px]">
              {banners[slide]?.title ?? 'Farm fresh, every morning'}
            </h1>
            <p className="mt-2 max-w-md text-white/85">{banners[slide]?.subtitle ?? 'Vegetables & fruits picked at dawn and delivered in your slot.'}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {d?.categories[0] && (
                <Link to={`/category/${d.categories[0].id}`} className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:bg-cream">
                  Shop now
                </Link>
              )}
              <span className="font-script text-2xl text-[#9be36f]">Sabjii le lo, taaza le lo!</span>
            </div>
          </div>
          <img src="/icons/basket.webp" alt="" className="animate-leaf mx-auto hidden h-52 w-52 object-contain drop-shadow-2xl md:block" />
        </div>
        {banners.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {banners.map((b, i) => (
              <button key={b.id} onClick={() => setSlide(i)} className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`} aria-label={`Banner ${i + 1}`} />
            ))}
          </div>
        )}
      </section>

      {/* Promises */}
      <section className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
        {[
          { icon: <ShieldCheck size={20} />, title: 'Freshness promise', text: 'Not fresh? Return it at the door' },
          { icon: <Truck size={20} />, title: d ? `Free delivery above ${formatINR(d.area.freeDeliveryAbovePaise)}` : 'Free delivery', text: 'In the slot you choose' },
          { icon: <Sparkles size={20} />, title: 'Direct from the mandi', text: 'Bought fresh every morning' },
        ].map((p) => (
          <div key={p.title} className="flex min-w-[240px] items-center gap-3 rounded-2xl border border-line/70 bg-white p-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-light-green text-primary">{p.icon}</span>
            <span>
              <span className="block text-sm font-semibold text-ink">{p.title}</span>
              <span className="text-xs text-muted">{p.text}</span>
            </span>
          </div>
        ))}
      </section>

      {/* Categories */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl">Shop by category</h2>
          <Link to="/categories" className="flex items-center text-sm font-semibold text-primary md:hidden">
            All <ChevronRight size={16} />
          </Link>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-6">
          {home.isLoading ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28 w-[84px] shrink-0 sm:w-auto" />) : d?.categories.map((c, i) => <CategoryTile key={c.id} c={c} i={i} />)}
        </div>
      </section>

      {/* Fresh picks */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl">Today's fresh picks</h2>
            {d && <p className="text-xs text-muted">In stock for delivery {formatDateLabel(d.deliveryDate).toLowerCase()}</p>}
          </div>
          {d?.categories[0] && (
            <Link to={`/category/${d.categories[0].id}`} className="flex items-center text-sm font-semibold text-primary">
              See all <ChevronRight size={16} />
            </Link>
          )}
        </div>
        {home.isLoading ? <ProductGridSkeleton /> : d?.freshPicks.length ? <ProductGrid items={d.freshPicks} /> : <EmptyState title="Restocking" text="Fresh stock for the next slot is being loaded. Check back soon!" />}
      </section>

      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-beige via-mint to-light-green p-6 sm:p-8">
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <img src="/icons/farmer.webp" alt="" className="h-28 w-28 object-contain" />
          <div className="flex-1 text-center sm:text-left">
            <span className="font-script text-2xl text-primary">Our freshness promise</span>
            <h3 className="text-xl">Not fresh? Don't pay for it.</h3>
            <p className="mt-1 max-w-xl text-sm text-body/80">Check every item at your door. Hand back anything you don't like and it comes off your bill instantly — refunds are automatic for prepaid orders.</p>
          </div>
          <Link to="/help" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white">
            How it works
          </Link>
        </div>
      </section>
    </div>
  );
}

export function CategoriesPage() {
  const { area } = useShop();
  const home = useQuery({ queryKey: qk.catalogHome(area?.id ?? ''), queryFn: () => api.catalog.home(area!.id), enabled: !!area });
  return (
    <div>
      <h1 className="mb-5 text-xl">All categories</h1>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-6">
        {home.isLoading ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28" />) : home.data?.categories.map((c, i) => <CategoryTile key={c.id} c={c} i={i} />)}
      </div>
    </div>
  );
}
