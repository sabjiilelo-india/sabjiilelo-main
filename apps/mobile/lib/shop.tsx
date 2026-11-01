import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { storage } from './storage';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import type { AreaRef, Cart } from '@sabjiilelo/shared';
import { api } from './api';
import { useAuth } from './auth';
import { toast } from '../components/toast';

const KEY = 'sl_location';

interface ShopState {
  ready: boolean;
  area: AreaRef | null;
  pincode: string | null;
  setLocation: (area: AreaRef, pincode: string) => void;
}

const Ctx = createContext<ShopState | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [area, setArea] = useState<AreaRef | null>(null);
  const [pincode, setPincode] = useState<string | null>(null);

  useEffect(() => {
    storage.get(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as { area: AreaRef; pincode: string };
        setArea(saved.area);
        setPincode(saved.pincode);
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const setLocation = useCallback((a: AreaRef, pin: string) => {
    setArea(a);
    setPincode(pin);
    storage.set(KEY, JSON.stringify({ area: a, pincode: pin })).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ ready, area, pincode, setLocation }), [ready, area, pincode, setLocation]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShop() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useShop outside ShopProvider');
  return v;
}

export function useCart() {
  const { area } = useShop();
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = qk.cart(area?.id ?? '');
  const query = useQuery({ queryKey: key, queryFn: () => api.me.cart(area!.id), enabled: !!area && user?.role === 'CUSTOMER' });

  const mutation = useMutation({
    mutationFn: ({ variantId, qty }: { variantId: string; qty: number }) => api.me.setCart(variantId, qty),
    onMutate: async ({ variantId, qty }) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Cart>(key);
      if (prev) {
        const lines = prev.lines.map((l) => (l.variantId === variantId ? { ...l, qty } : l)).filter((l) => l.qty > 0);
        qc.setQueryData<Cart>(key, { lines, itemCount: lines.reduce((s, l) => s + l.qty, 0), subtotalPaise: lines.reduce((s, l) => s + l.qty * l.pricePaise, 0) });
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast((e as Error).message);
    },
    onSuccess: (cart) => qc.setQueryData(key, cart),
    // Any cached checkout total is now out of date.
    onSettled: () => qc.invalidateQueries({ queryKey: ['me', 'quote'] }),
  });

  return {
    cart: query.data ?? { lines: [], itemCount: 0, subtotalPaise: 0 },
    isLoading: query.isLoading,
    refetch: query.refetch,
    qtyOf: (variantId: string) => query.data?.lines.find((l) => l.variantId === variantId)?.qty ?? 0,
    setQty: (variantId: string, qty: number) => mutation.mutate({ variantId, qty }),
  };
}
