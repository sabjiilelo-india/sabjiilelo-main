import { View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { formatDateLabel, formatINR } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { Button, Card, Empty, Loader, Row, Screen, StatusBadge, T, colors, font } from '../../components/ui';

export default function OrdersTab() {
  const q = useQuery({ queryKey: qk.myOrders, queryFn: () => api.me.orders(1) });
  if (q.isLoading) return <Loader />;
  return (
    <Screen edges={[]} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {!q.data?.data.length ? (
        <Empty image={require('../../assets/truck.webp')} title="No orders yet" text="Your fresh orders will show up here." action={<Button title="Start shopping" onPress={() => router.navigate('/(customer)')} />} />
      ) : (
        <View style={{ gap: 10 }}>
          {q.data.data.map((o) => (
            <Card key={o.id} onPress={() => router.push(`/order/${o.id}`)}>
              <Row style={{ gap: 12 }}>
                {o.previewImages[0] ? (
                  <Image source={{ uri: o.previewImages[0] }} style={{ width: 48, height: 48, borderRadius: 12 }} />
                ) : (
                  <Image source={require('../../assets/basket.webp')} style={{ width: 48, height: 48 }} contentFit="contain" />
                )}
                <View style={{ flex: 1 }}>
                  <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                    <T style={{ fontFamily: font.semibold, color: colors.ink }}>#{o.orderNo}</T>
                    <StatusBadge status={o.status} />
                  </Row>
                  <T v="small">
                    {o.itemCount} items · {o.slotDate ? `${formatDateLabel(o.slotDate)} ${o.slotLabel ?? ''}` : ''}
                  </T>
                </View>
                <T style={{ fontFamily: font.semibold }}>{formatINR(o.finalPayablePaise)}</T>
              </Row>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
