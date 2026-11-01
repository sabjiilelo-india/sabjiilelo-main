import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Clock, ShieldCheck, Truck } from 'lucide-react';
import { qk } from '@sabjiilelo/api-client';
import { formatDateLabel, formatINR, formatTime12, produceEmoji } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { useShop } from '../../lib/shop';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui';
import { ProductGrid, ProductGridSkeleton } from './components';

const CATEGORY_ICON: Record<string, string> = {
  'Fresh Vegetables': '🥕',
  'Leafy & Herbs': '🌿',
  'Fresh Fruits': '🍎',
  Exotic: '🥦',
  'Daily Essentials': '🥥',
};

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
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-dark-green to-deep text-white shadow-lift">
        {banners.map((b, i) => (
          <img key={b.id} src={b.imageUrl} alt="" className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === slide ? 'opacity-40' : 'opacity-0'}`} />
        ))}
        <div className="relative grid gap-6 p-6 sm:p-10 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              <Clock size={14} />
              {d?.nextSlot ? `Next delivery: ${formatDateLabel(d.nextSlot.date)}, ${formatTime12(d.nextSlot.startTime)}–${formatTime12(d.nextSlot.endTime)}` : 'Loading slots…'}
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl">{banners[slide]?.title ?? 'Farm fresh, every morning'}</h1>
            <p className="mt-2 max-w-md text-white/85">{banners[slide]?.subtitle ?? 'Vegetables & fruits picked at dawn and delivered in your slot.'}</p>
            <p className="mt-4 font-script text-3xl text-[#9be36f]">Sabjii le lo, taaza le lo!</p>
          </div>
          <img src="/icons/basket.webp" alt="" className="animate-leaf mx-auto hidden h-48 w-48 object-contain drop-shadow-2xl md:block" />
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
      <section className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { icon: <ShieldCheck size={20} />, title: 'Freshness promise', text: 'Return at the door' },
          { icon: <Truck size={20} />, title: d ? `Free above ${formatINR(d.area.freeDeliveryAbovePaise)}` : 'Free delivery', text: 'In your chosen slot' },
          { icon: <span className="text-lg">🌾</span>, title: 'Direct from mandi', text: 'Bought fresh daily' },
        ].map((p) => (
          <div key={p.title} className="card flex flex-col items-center gap-1 p-3 text-center sm:flex-row sm:gap-3 sm:text-left">
            <span className="rounded-xl bg-light-green p-2 text-primary">{p.icon}</span>
            <span>
              <span className="block text-xs font-semibold text-ink sm:text-sm">{p.title}</span>
              <span className="hidden text-xs text-muted sm:block">{p.text}</span>
            </span>
          </div>
        ))}
      </section>

      {/* Categories */}
      <section>
        <h2 className="mb-3 text-lg">Shop by category</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {home.isLoading
            ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-28" />)
            : d?.categories.map((c) => (
                <Link key={c.id} to={`/category/${c.id}`} className="card group flex flex-col items-center gap-2 p-4 text-center transition hover:-translate-y-0.5 hover:border-primary/40">
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint text-3xl transition group-hover:scale-110">{CATEGORY_ICON[c.name] ?? produceEmoji(c.name)}</span>
                  )}
                  <span className="text-xs font-semibold text-ink sm:text-sm">{c.name}</span>
                </Link>
              ))}
        </div>
      </section>

      {/* Fresh picks */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-lg">Today's fresh picks</h2>
            {d && <p className="text-xs text-muted">Stock for delivery on {formatDateLabel(d.deliveryDate).toLowerCase()}</p>}
          </div>
          {d?.categories[0] && (
            <Link to={`/category/${d.categories[0].id}`} className="flex items-center text-sm font-medium text-primary">
              See all <ChevronRight size={16} />
            </Link>
          )}
        </div>
        {home.isLoading ? <ProductGridSkeleton n={10} /> : d?.freshPicks.length ? <ProductGrid items={d.freshPicks} /> : <EmptyState title="Restocking" text="Fresh stock for the next slot is being loaded. Check back soon!" />}
      </section>

      <section className="card flex flex-col items-center gap-4 overflow-hidden bg-gradient-to-r from-beige to-mint p-6 sm:flex-row">
        <img src="/icons/farmer.webp" alt="" className="h-24 w-24 object-contain" />
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-lg">Not fresh? Don't pay for it.</h3>
          <p className="text-sm text-muted">Check every item at your door. Hand back anything you don't like and it comes off your bill instantly — refunds are automatic for prepaid orders.</p>
        </div>
      </section>
    </div>
  );
}
