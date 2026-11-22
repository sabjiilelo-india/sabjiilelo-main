import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { formatDateLabel, formatINR } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { AddButton, discountPct } from '../../components/ProductCard';
import { CartBar } from '../../components/CartBar';
import { NutritionCard } from '../../components/NutritionCard';
import { Card, Empty, ProduceImage, Row, Screen, Skeleton, T, colors, font } from '../../components/ui';

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const q = useQuery({ queryKey: qk.catalogItem(id), queryFn: () => api.catalog.item(id) });
  const [vi, setVi] = useState(0);
  if (q.isLoading) {
    return (
      <View style={{ flex: 1 }}>
        <Skeleton height={width * 0.8} radius={0} />
        <View style={{ padding: 16, gap: 10 }}>
          <Skeleton height={28} width="60%" />
          <Skeleton height={14} />
          <Skeleton height={72} radius={16} />
        </View>
      </View>
    );
  }
  if (!q.data) return <Empty title="Item not found" />;
  const { item, date } = q.data;
  const picked = item.variants[vi] ?? item.variants[0]!;
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: item.name }} />
      <Screen edges={[]} padded={false} style={{ paddingBottom: 170 }}>
        <ProduceImage uri={item.images[0]} name={item.name} size={width} style={{ borderRadius: 0, height: width * 0.8 }} />
        <View style={{ padding: 16, marginTop: -22, backgroundColor: colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
          <T v="h1">{item.name}</T>
          {!!item.nutrition?.tag && (
            <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff3d6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 }}>
              <T style={{ color: '#8a5a00' }}>✨ {item.nutrition.tag}</T>
            </View>
          )}
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
            <T v="label">Choose pack size</T>
            {item.variants.map((v, i) => {
              const off = discountPct(v);
              const sel = i === vi;
              return (
                <Card key={v.id} onPress={() => setVi(i)} style={{ borderWidth: 2, borderColor: sel ? colors.primary : '#efe8d8', backgroundColor: sel ? colors.mint : '#fff' }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View>
                      <T style={{ fontFamily: font.semibold, color: colors.ink }}>{v.label}</T>
                      <Row style={{ gap: 6 }}>
                        <T style={{ fontFamily: font.semibold, color: colors.primary, fontSize: 17 }}>{formatINR(v.pricePaise)}</T>
                        {off > 0 && <T v="small" style={{ textDecorationLine: 'line-through' }}>{formatINR(v.mrpPaise)}</T>}
                        {off > 0 && <T v="tiny" style={{ color: colors.accent }}>{off}% off</T>}
                      </Row>
                    </View>
                    <Ionicons name={sel ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={sel ? colors.primary : colors.line} />
                  </Row>
                </Card>
              );
            })}
          </View>
          {item.nutrition && <NutritionCard nutrition={item.nutrition} />}
          <Card style={{ marginTop: 16, backgroundColor: colors.mint, flexDirection: 'row', gap: 10 }}>
            <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
            <T style={{ flex: 1 }}>
              <T style={{ fontFamily: font.semibold, color: colors.ink }}>Freshness promise. </T>
              Open-box delivery: check it at your door. If it isn't fresh, hand it back and it's off your bill.
              You can also cancel any time until it reaches you.
            </T>
          </Card>
        </View>
      </Screen>
      {/* Sticky add-to-cart bar for the chosen pack size */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: colors.line,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <T v="tiny" numberOfLines={1}>
            {picked.label}
          </T>
          <Row style={{ gap: 6 }}>
            <T style={{ fontFamily: font.bold, color: colors.ink, fontSize: 20 }}>{formatINR(picked.pricePaise)}</T>
            {discountPct(picked) > 0 && <T v="small" style={{ textDecorationLine: 'line-through' }}>{formatINR(picked.mrpPaise)}</T>}
          </Row>
        </View>
        <AddButton item={item} variant={picked} small={false} />
      </View>
      <CartBar bottom={78} />
    </View>
  );
}
