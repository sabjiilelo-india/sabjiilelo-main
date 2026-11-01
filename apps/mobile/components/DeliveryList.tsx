import { View } from 'react-native';
import { router } from 'expo-router';
import { formatDateLabel, formatINR, type OrderSummary } from '@sabjiilelo/shared';
import { Badge, Card, Row, StatusBadge, T, colors, font } from './ui';

export function DeliveryList({ orders }: { orders: OrderSummary[] }) {
  return (
    <View style={{ gap: 10 }}>
      {orders.map((o) => (
        <Card key={o.id} onPress={() => router.push(`/delivery/${o.id}`)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T style={{ fontFamily: font.semibold, color: colors.ink }}>#{o.orderNo}</T>
            <StatusBadge status={o.status} />
          </Row>
          <T style={{ marginTop: 4, color: colors.ink }}>{o.customerName}</T>
          <T v="small">
            📍 {o.pincode} · {o.slotDate ? `${formatDateLabel(o.slotDate)} ${o.slotLabel ?? ''}` : ''} · {o.itemCount} items
          </T>
          <View style={{ marginTop: 8 }}>
            {o.paymentMode === 'COD' ? <Badge label={`Collect ${formatINR(o.finalPayablePaise)}`} tone="orange" /> : <Badge label="Prepaid" tone="green" />}
          </View>
        </Card>
      ))}
    </View>
  );
}
