import { Switch, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { formatINR } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { DeliveryList } from '../../components/DeliveryList';
import { Card, Empty, Loader, Row, Screen, T, colors, font } from '../../components/ui';

export default function Deliveries() {
  const { user, setUser } = useAuth();
  const q = useQuery({ queryKey: qk.riderOrders('active'), queryFn: () => api.rider.orders('active'), refetchInterval: 30_000 });
  const cash = useQuery({ queryKey: qk.riderCash(), queryFn: () => api.rider.cash() });
  const online = useMutation({ mutationFn: (v: boolean) => api.rider.setOnline(v), onSuccess: (r) => user && setUser({ ...user, isOnline: r.isOnline }) });

  return (
    <Screen
      refreshing={q.isRefetching}
      onRefresh={() => {
        q.refetch();
        cash.refetch();
      }}
    >
      <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <View>
          <T v="tiny">{user?.area?.name}</T>
          <T v="h1">Hi {user?.name?.split(' ')[0] ?? 'there'} 👋</T>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Switch value={!!user?.isOnline} onValueChange={(v) => online.mutate(v)} trackColor={{ true: colors.leaf }} />
          <T v="tiny" style={{ color: user?.isOnline ? colors.primary : colors.muted }}>
            {user?.isOnline ? 'Online' : 'Offline'}
          </T>
        </View>
      </Row>
      <Row style={{ gap: 10, marginBottom: 16 }}>
        <Card style={{ flex: 1 }}>
          <T v="tiny">Delivered today</T>
          <T style={{ fontFamily: font.bold, fontSize: 22, color: colors.ink }}>{cash.data?.deliveredCount ?? 0}</T>
        </Card>
        <Card style={{ flex: 1 }}>
          <T v="tiny">Cash in hand</T>
          <T style={{ fontFamily: font.bold, fontSize: 22, color: colors.accent }}>{formatINR(Math.max(0, (cash.data?.codExpectedPaise ?? 0) - (cash.data?.depositedPaise ?? 0)))}</T>
        </Card>
      </Row>
      <T v="h3" style={{ marginBottom: 10 }}>
        To deliver ({q.data?.length ?? 0})
      </T>
      {q.isLoading ? <Loader /> : q.data?.length ? <DeliveryList orders={q.data} /> : <Empty image={require('../../assets/truck.webp')} title="No deliveries assigned" text="New orders appear here when the store assigns them to you." />}
    </Screen>
  );
}
