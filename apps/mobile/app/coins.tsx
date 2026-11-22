import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { COIN_EARN_PERCENT, COIN_MAX_REDEEM_PERCENT, type CoinTxn } from '@sabjiilelo/shared';
import { api } from '../lib/api';
import { Button, Card, Empty, Row, Screen, Skeleton, T, colors, font } from '../components/ui';
import { LinearGradientFallback } from '../components/Hero';

const TYPE: Record<CoinTxn['type'], { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  EARN: { label: 'Earned', icon: 'add-circle', color: colors.primary },
  SPEND: { label: 'Used', icon: 'remove-circle', color: colors.accent },
  REFUND: { label: 'Returned', icon: 'refresh-circle', color: '#1d6fa5' },
};

export default function Coins() {
  const q = useQuery({ queryKey: qk.coins, queryFn: () => api.me.coins() });
  const d = q.data;

  return (
    <Screen edges={[]} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <LinearGradientFallback style={{ borderRadius: 26, padding: 20, alignItems: 'center' }}>
        <T style={{ fontSize: 40 }}>🪙</T>
        {q.isLoading ? (
          <Skeleton width={120} height={44} style={{ marginVertical: 6 }} />
        ) : (
          <T style={{ fontFamily: font.bold, fontSize: 40, color: '#fff' }}>{d?.balance ?? 0}</T>
        )}
        <T style={{ color: 'rgba(255,255,255,0.85)' }}>Sabjii Coins · worth ₹{d?.balance ?? 0}</T>
      </LinearGradientFallback>

      <Card style={{ marginTop: 14 }}>
        <T v="h3" style={{ marginBottom: 8 }}>
          How it works
        </T>
        {[
          { icon: 'bag-check-outline' as const, text: `Earn ${COIN_EARN_PERCENT}% back as coins on every delivered order.` },
          { icon: 'pricetag-outline' as const, text: `Use coins at checkout to pay up to ${COIN_MAX_REDEEM_PERCENT}% of a bill.` },
          { icon: 'cash-outline' as const, text: '1 coin = ₹1 off.' },
          { icon: 'refresh-outline' as const, text: 'Coins you use come back if you cancel the order.' },
        ].map((r) => (
          <Row key={r.text} style={{ gap: 10, paddingVertical: 6 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#fff3d6', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={r.icon} size={18} color="#8a5a00" />
            </View>
            <T style={{ flex: 1, color: colors.ink }}>{r.text}</T>
          </Row>
        ))}
      </Card>

      <T v="h3" style={{ marginTop: 18, marginBottom: 8 }}>
        History
      </T>
      {q.isLoading ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={60} radius={16} />
          <Skeleton height={60} radius={16} />
        </View>
      ) : !d?.history.length ? (
        <Empty
          title="No coins yet"
          text="Get your first order delivered to start earning."
          action={<Button title="Start shopping" onPress={() => router.navigate('/(customer)')} />}
        />
      ) : (
        <Card style={{ padding: 0 }}>
          {d.history.map((h, i) => {
            const t = TYPE[h.type];
            return (
              <Row key={h.id} style={{ padding: 12, gap: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                <Ionicons name={t.icon} size={26} color={t.color} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontFamily: font.medium, color: colors.ink }} numberOfLines={1}>
                    {h.note ?? t.label}
                  </T>
                  <T v="tiny">
                    {new Date(h.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {h.orderNo ? ` · #${h.orderNo}` : ''}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T style={{ fontFamily: font.bold, color: h.coins >= 0 ? colors.primary : colors.accent }}>
                    {h.coins >= 0 ? '+' : ''}
                    {h.coins}
                  </T>
                  <T v="tiny">Balance {h.balanceAfter}</T>
                </View>
              </Row>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
