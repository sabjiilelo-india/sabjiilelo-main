import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Coins, RotateCcw } from 'lucide-react';
import { qk } from '@sabjiilelo/api-client';
import { COIN_EARN_PERCENT, COIN_MAX_REDEEM_PERCENT } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { Card, EmptyState, ErrorState, Skeleton } from '../../components/ui';
import { AccountShell } from './Account';

const TYPE_UI = {
  EARN: { icon: ArrowDownLeft, label: 'Earned', tone: 'bg-light-green text-primary' },
  SPEND: { icon: ArrowUpRight, label: 'Used', tone: 'bg-accent/15 text-[#c25a14]' },
  REFUND: { icon: RotateCcw, label: 'Returned', tone: 'bg-sky-100 text-sky-700' },
} as const;

export function CoinsPage() {
  const q = useQuery({ queryKey: qk.coins, queryFn: () => api.me.coins() });
  return (
    <AccountShell title="Sabjii Coins">
      <div className="max-w-xl space-y-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 to-accent p-6 text-white shadow-card">
          <Coins size={110} className="absolute -right-4 -top-4 opacity-20" />
          <div className="relative">
            <div className="text-sm font-medium text-white/90">Your balance</div>
            {q.isLoading ? <Skeleton className="mt-2 h-10 w-24 bg-white/30" /> : <div className="mt-1 text-4xl font-bold">{q.data?.balance ?? 0}</div>}
            <div className="mt-1 text-sm text-white/90">1 coin = ₹1 off your bill</div>
          </div>
        </div>

        <Card className="p-5">
          <h2 className="mb-3 text-base">How it works</h2>
          <ul className="space-y-2.5 text-sm text-body">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-light-green text-xs font-bold text-primary">1</span>
              <span>
                Earn <b>{COIN_EARN_PERCENT}% back in coins</b> on every delivered order.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-light-green text-xs font-bold text-primary">2</span>
              <span>
                Use coins at checkout to pay up to <b>{COIN_MAX_REDEEM_PERCENT}% of your bill</b>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-light-green text-xs font-bold text-primary">3</span>
              <span>If you cancel an order, the coins you used come straight back.</span>
            </li>
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="mb-2 text-base">History</h2>
          {q.error ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : q.isLoading ? (
            <Skeleton className="h-24" />
          ) : !q.data?.history.length ? (
            <EmptyState
              icon="/icons/basket.webp"
              title="No coins yet"
              text="Place your first order and you will start earning Sabjii Coins."
              action={
                <Link to="/" className="text-sm font-semibold text-primary">
                  Start shopping
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-line/70">
              {q.data.history.map((h) => {
                const ui = TYPE_UI[h.type];
                const Icon = ui.icon;
                return (
                  <li key={h.id} className="flex items-center gap-3 py-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ui.tone}`}>
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{h.note ?? ui.label}</span>
                      <span className="block text-xs text-muted">{new Date(h.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </span>
                    <span className="text-right">
                      <span className={`block text-sm font-bold ${h.coins > 0 ? 'text-primary' : 'text-[#c25a14]'}`}>{h.coins > 0 ? `+${h.coins}` : h.coins}</span>
                      <span className="block text-[11px] text-muted">Balance {h.balanceAfter}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </AccountShell>
  );
}
