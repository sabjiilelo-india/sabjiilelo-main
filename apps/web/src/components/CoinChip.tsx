import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Coins } from 'lucide-react';
import { qk } from '@sabjiilelo/api-client';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

/** The signed-in customer's Sabjii Coins balance, or undefined for guests and staff. */
export function useCoinBalance() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: qk.coins, queryFn: () => api.me.coins(), enabled: user?.role === 'CUSTOMER', staleTime: 30_000 });
  return q.data?.balance;
}

/** Small pill linking to the coins page. */
export function CoinChip({ className = '' }: { className?: string }) {
  const balance = useCoinBalance();
  if (balance == null) return null;
  return (
    <Link
      to="/account/coins"
      className={`inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-200 ${className}`}
      aria-label={`${balance} Sabjii Coins`}
    >
      <Coins size={16} /> {balance}
      <span className="hidden font-medium lg:inline">coins</span>
    </Link>
  );
}
