import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { api } from './api';
import { useAuth } from './auth';

/** The signed-in customer's Sabjii Coins balance (0 while loading or for staff). */
export function useCoins() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: qk.coins, queryFn: () => api.me.coins(), enabled: user?.role === 'CUSTOMER', staleTime: 60_000 });
  return { balance: q.data?.balance ?? 0, isLoading: q.isLoading };
}
