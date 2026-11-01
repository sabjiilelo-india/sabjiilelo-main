import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { formatDateLabel, formatINR, formatTime12, produceEmoji } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { useShop } from '../../lib/shop';
import { CartBar } from '../../components/CartBar';
import { ProductGrid } from '../../components/ProductCard';
import { Card, Empty, Loader, Row, Screen, T, colors, font } from '../../components/ui';

const CATEGORY_ICON: Record<string, string> = {
  'Fresh Vegetables': '🥕',
  'Leafy & Herbs': '🌿',
  'Fresh Fruits': '🍎',
  Exotic: '🥦',
  'Daily Essentials': '🥥',
};

export default function Home() {
  const { width } = useWindowDimensions();
  const { area, pincode } = useShop();
  const q = useQuery({ queryKey: qk.catalogHome(area?.id ?? ''), queryFn: () => api.catalog.home(area!.id), enabled: !!area });
  const [slide, setSlide] = useState(0);
  const bannerRef = useRef<ScrollView>(null);
  const banners = q.data?.banners ?? [];
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => {
      setSlide((s) => {
        const n = (s + 1) % banners.length;
        bannerRef.current?.scrollTo({ x: n * (width - 32), animated: true });
        return n;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [banners.length, width]);

  const d = q.data;
  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()} style={{ paddingBottom: 100 }}>
        {/* Header */}
        <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <Pressable onPress={() => router.push('/location')} style={{ flexShrink: 1 }}>
            <T v="tiny">Deliver to</T>
            <Row style={{ gap: 4 }}>
              <Ionicons name="location" size={16} color={colors.accent} />
              <T v="h3" numberOfLines={1}>
                {area?.name} {pincode}
              </T>
              <Ionicons name="chevron-down" size={14} color={colors.ink} />
            </Row>
          </Pressable>
          <Pressable onPress={() => router.push('/notifications')} hitSlop={10}>
            <Ionicons name="notifications-outline" size={24} color={colors.ink} />
          </Pressable>
        </Row>

        <Pressable onPress={() => router.push('/(customer)/browse')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 16, height: 46, borderWidth: 1, borderColor: colors.line, marginBottom: 16 }}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <T v="small">Search tomato, apple, palak…</T>
        </Pressable>

        {q.isLoading ? (
          <Loader />
        ) : !d ? (
          <Empty title="Couldn't load the shop" text="Pull down to retry." />
        ) : (
          <>
            {/* Banner */}
            <View style={{ borderRadius: 24, overflow: 'hidden', backgroundColor: colors.primary, marginBottom: 14 }}>
              <ScrollView ref={bannerRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / (width - 32)))}>
                {(banners.length ? banners : [{ id: 'x', title: 'Farm fresh, every morning', subtitle: 'Picked at dawn', imageUrl: '' }]).map((b) => (
                  <View key={b.id} style={{ width: width - 32, height: 170, justifyContent: 'flex-end' }}>
                    {!!b.imageUrl && <Image source={{ uri: b.imageUrl }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.55 }} contentFit="cover" />}
                    <View style={{ padding: 16 }}>
                      <T style={{ color: '#fff', fontFamily: font.bold, fontSize: 20 }}>{b.title}</T>
                      {b.subtitle && <T style={{ color: 'rgba(255,255,255,0.9)' }}>{b.subtitle}</T>}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            {d.nextSlot && (
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18, backgroundColor: colors.mint }}>
                <Image source={require('../../assets/truck.webp')} style={{ width: 44, height: 44 }} contentFit="contain" />
                <View style={{ flex: 1 }}>
                  <T style={{ fontFamily: font.semibold, color: colors.ink }}>
                    Next delivery: {formatDateLabel(d.nextSlot.date)}, {formatTime12(d.nextSlot.startTime)}–{formatTime12(d.nextSlot.endTime)}
                  </T>
                  <T v="small">Free delivery above {formatINR(d.area.freeDeliveryAbovePaise)}</T>
                </View>
              </Card>
            )}

            <T v="h3" style={{ marginBottom: 10 }}>
              Shop by category
            </T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 6 }} style={{ marginBottom: 18 }}>
              {d.categories.map((c) => (
                <Pressable key={c.id} onPress={() => router.push(`/category/${c.id}`)} style={{ alignItems: 'center', width: 82 }}>
                  <View style={{ width: 68, height: 68, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line }}>
                    {c.imageUrl ? <Image source={{ uri: c.imageUrl }} style={{ width: 52, height: 52, borderRadius: 12 }} /> : <T style={{ fontSize: 32 }}>{CATEGORY_ICON[c.name] ?? produceEmoji(c.name)}</T>}
                  </View>
                  <T v="tiny" style={{ color: colors.ink, textAlign: 'center', marginTop: 6 }} numberOfLines={2}>
                    {c.name}
                  </T>
                </Pressable>
              ))}
            </ScrollView>

            <T v="h3">Today's fresh picks</T>
            <T v="small" style={{ marginBottom: 10 }}>
              Stock for delivery {formatDateLabel(d.deliveryDate).toLowerCase()}
            </T>
            {d.freshPicks.length ? <ProductGrid items={d.freshPicks} width={width} /> : <Empty title="Restocking" text="Fresh stock for the next slot is on its way." />}

            <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 18, backgroundColor: colors.beige }}>
              <Image source={require('../../assets/farmer.webp')} style={{ width: 60, height: 60 }} contentFit="contain" />
              <View style={{ flex: 1 }}>
                <T v="h3">Not fresh? Don't pay for it.</T>
                <T v="small">Check every item at your door and hand back anything you don't like.</T>
              </View>
            </Card>
          </>
        )}
      </Screen>
      <CartBar />
    </View>
  );
}
