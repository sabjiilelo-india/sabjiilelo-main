import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import type { AreaRef, Cart } from '@sabjiilelo/shared';
import { api } from './api';
import { useAuth } from './auth';
import { toast } from '../components/toast';

/** The delivery area the shopper is browsing, picked by pincode and remembered in the browser. */
interface ShopState {
  area: AreaRef | null;
  pincode: string | null;
  setLocation: (area: AreaRef, pincode: string) => void;
  clearLocation: () => void;
}

const KEY = 'sl_location';
const Ctx = createContext<ShopState | null>(null);

function readSaved(): { area: AreaRef; pincode: string } | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const saved = readSaved();
  const [area, setArea] = useState<AreaRef | null>(saved?.area ?? null);
  const [pincode, setPincode] = useState<string | null>(saved?.pincode ?? null);
  const { user } = useAuth();

  const setLocation = useCallback((a: AreaRef, pin: string) => {
    setArea(a);
    setPincode(pin);
    try {
      localStorage.setItem(KEY, JSON.stringify({ area: a, pincode: pin }));
    } catch {
      /* private mode */
    }
  }, []);

  const clearLocation = useCallback(() => {
    setArea(null);
    setPincode(null);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // The saved area can be stale (the database moved, an area was re-created). Re-check it once on load:
  // follow the pincode to the current area, or forget it if we no longer deliver there.
  useEffect(() => {
    const saved = readSaved();
    if (!saved?.pincode) return;
    api.catalog
      .serviceability(saved.pincode)
      .then((r) => {
        if (!r.serviceable || !r.area) clearLocation();
        else if (r.area.id !== saved.area?.id) setLocation(r.area, saved.pincode);
      })
      .catch(() => undefined); // offline: keep what we have
  }, [setLocation, clearLocation]);

  // A returning customer with a saved address starts in that address's area.
  const addresses = useQuery({
    queryKey: qk.addresses,
    queryFn: api.me.addresses,
    enabled: user?.role === 'CUSTOMER' && !area,
  });
  useEffect(() => {
    if (area || !addresses.data) return;
    const def = addresses.data.find((a) => a.isDefault && a.serviceable) ?? addresses.data.find((a) => a.serviceable);
    if (def) api.catalog.serviceability(def.pincode).then((r) => r.area && setLocation(r.area, def.pincode));
  }, [addresses.data, area, setLocation]);

  const value = useMemo(() => ({ area, pincode, setLocation, clearLocation }), [area, pincode, setLocation, clearLocation]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShop() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useShop outside ShopProvider');
  return v;
}

/** Server-side cart for the current area. Guests get an empty cart. */
export function useCart() {
  const { area } = useShop();
  const { user } = useAuth();
  const qc = useQueryClient();
  const enabled = !!area && user?.role === 'CUSTOMER';
  const query = useQuery({ queryKey: qk.cart(area?.id ?? ''), queryFn: () => api.me.cart(area!.id), enabled });

  const mutation = useMutation({
    mutationFn: ({ variantId, qty }: { variantId: string; qty: number }) => api.me.setCart(variantId, qty),
    onMutate: async ({ variantId, qty }) => {
      const key = qk.cart(area?.id ?? '');
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Cart>(key);
      if (prev) {
        const lines = prev.lines.map((l) => (l.variantId === variantId ? { ...l, qty } : l)).filter((l) => l.qty > 0);
        qc.setQueryData<Cart>(key, {
          lines,
          itemCount: lines.reduce((s, l) => s + l.qty, 0),
          subtotalPaise: lines.reduce((s, l) => s + l.qty * l.pricePaise, 0),
        });
      }
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.cart(area?.id ?? ''), ctx.prev);
      toast.error((err as Error).message);
    },
    onSuccess: (cart) => qc.setQueryData(qk.cart(area?.id ?? ''), cart),
    // Any cached checkout total is now out of date.
    onSettled: () => qc.invalidateQueries({ queryKey: ['me', 'quote'] }),
  });

  const qtyOf = (variantId: string) => query.data?.lines.find((l) => l.variantId === variantId)?.qty ?? 0;
  return {
    cart: query.data ?? { lines: [], itemCount: 0, subtotalPaise: 0 },
    isLoading: query.isLoading,
    enabled,
    qtyOf,
    setQty: (variantId: string, qty: number) => mutation.mutate({ variantId, qty }),
  };
}
