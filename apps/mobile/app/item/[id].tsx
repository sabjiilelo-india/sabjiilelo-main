import { useWindowDimensions, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { formatDateLabel, formatINR } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { AddButton, discountPct } from '../../components/ProductCard';
import { CartBar } from '../../components/CartBar';
import { Card, Empty, Loader, ProduceImage, Row, Screen, T, colors, font } from '../../components/ui';

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const q = useQuery({ queryKey: qk.catalogItem(id), queryFn: () => api.catalog.item(id) });
  if (q.isLoading) return <Loader />;
  if (!q.data) return <Empty title="Item not found" />;
  const { item, date } = q.data;
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: item.name }} />
      <Screen edges={[]} padded={false} style={{ paddingBottom: 100 }}>
        <ProduceImage uri={item.images[0]} name={item.name} size={width} style={{ borderRadius: 0, height: width * 0.8 }} />
        <View style={{ padding: 16 }}>
          <T v="h1">{item.name}</T>
          {item.sourceNote && (
            <View style={{ alignSelf: 'flex-start', backgroundColor: colors['light-green'], borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 }}>
              <T style={{ color: colors.primary }}>🌱 {item.sourceNote}</T>
            </View>
          )}
          {item.description && <T style={{ marginTop: 10 }}>{item.description}</T>}
          <T v="small" style={{ marginTop: 6 }}>
            Availability for delivery {formatDateLabel(date).toLowerCase()}
          </T>
          <View style={{ gap: 10, marginTop: 16 }}>
            {item.variants.map((v) => {
              const off = discountPct(v);
              return (
                <Card key={v.id}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View>
                      <T style={{ fontFamily: font.semibold, color: colors.ink }}>{v.label}</T>
                      <Row style={{ gap: 6 }}>
                        <T style={{ fontFamily: font.semibold, color: colors.primary, fontSize: 17 }}>{formatINR(v.pricePaise)}</T>
                        {off > 0 && <T v="small" style={{ textDecorationLine: 'line-through' }}>{formatINR(v.mrpPaise)}</T>}
                        {off > 0 && <T v="tiny" style={{ color: colors.accent }}>{off}% off</T>}
                      </Row>
                    </View>
                    <AddButton item={item} variant={v} small={false} />
                  </Row>
                </Card>
              );
            })}
          </View>
          <Card style={{ marginTop: 16, backgroundColor: colors.mint, flexDirection: 'row', gap: 10 }}>
            <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
            <T style={{ flex: 1 }}>
              <T style={{ fontFamily: font.semibold, color: colors.ink }}>Freshness promise. </T>
              Check it at your door. If it isn't fresh, hand it back and it's off your bill.
            </T>
          </Card>
        </View>
      </Screen>
      <CartBar />
    </View>
  );
}
