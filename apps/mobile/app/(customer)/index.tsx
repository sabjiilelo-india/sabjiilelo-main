import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { formatDateLabel, formatINR, produceEmoji } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { useShop } from '../../lib/shop';
import { useAuth } from '../../lib/auth';
import { useCoins } from '../../lib/coins';
import { CartBar } from '../../components/CartBar';
import { ProductGrid } from '../../components/ProductCard';
import { Card, CoinChip, Empty, Row, Screen, Skeleton, SkeletonGrid, T, colors, font } from '../../components/ui';

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
  const { user } = useAuth();
  const { balance } = useCoins();
  const q = useQuery({ queryKey: qk.catalogHome(area?.id ?? ''), queryFn: () => api.catalog.home(area!.id), enabled: !!area });
  const [slide, setSlide] = useState(0);
  const bannerRef = useRef<ScrollViewInstance>(null);
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
          <Row style={{ gap: 12 }}>
            <CoinChip coins={balance} onPress={() => router.push('/coins')} />
            <Pressable onPress={() => router.push('/notifications')} hitSlop={10}>
              <Ionicons name="notifications-outline" size={24} color={colors.ink} />
            </Pressable>
          </Row>
        </Row>

        <T style={{ fontFamily: font.bold, fontSize: 22, color: colors.ink }}>
          {user?.name ? `Hi ${user.name.split(' ')[0]} 👋` : 'Hello 👋'}
        </T>
        <T v="script" style={{ marginBottom: 12, marginTop: -2 }}>
          Taazi taazi sabji le lo
        </T>

        <Pressable onPress={() => router.navigate('/(customer)/browse')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 16, height: 46, borderWidth: 1, borderColor: colors.line, marginBottom: 16 }}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <T v="small">Search tomato, apple, palak…</T>
        </Pressable>

        {q.isLoading ? (
          <>
            <Skeleton height={170} radius={24} />
            <Skeleton height={64} radius={20} style={{ marginTop: 14 }} />
            <Skeleton height={20} width="40%" style={{ marginTop: 18, marginBottom: 12 }} />
            <SkeletonGrid width={width} rows={1} />
          </>
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

            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14, backgroundColor: colors.mint }}>
              <Image source={require('../../assets/truck.webp')} style={{ width: 48, height: 48 }} contentFit="contain" />
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: font.semibold, color: colors.ink }}>Delivery 7 AM – 11 PM · Open-box delivery</T>
                <T v="small">
                  {d.nextSlot ? `Next: ${formatDateLabel(d.nextSlot.date)} · ` : ''}Free delivery above {formatINR(d.area.freeDeliveryAbovePaise)}
                </T>
              </View>
            </Card>

            {/* Sabjii Coins banner */}
            <Pressable onPress={() => router.push('/coins')} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, marginBottom: 18 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff3d6', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#f3dfa8' }}>
                <T style={{ fontSize: 34 }}>🪙</T>
                <View style={{ flex: 1 }}>
                  <T style={{ fontFamily: font.bold, color: '#6b4500', fontSize: 15 }}>Earn Sabjii Coins on every order</T>
                  <T style={{ color: '#8a5a00', fontSize: 12.5 }}>{balance > 0 ? `You have ${balance} coins to spend (₹${balance} off)` : '2% back as coins · use them on your next bill'}</T>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#8a5a00" />
              </View>
            </Pressable>

            <T v="h3" style={{ marginBottom: 10 }}>
              Shop by category
            </T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 6 }} style={{ marginBottom: 18 }}>
              {d.categories.map((c) => (
                <Pressable key={c.id} onPress={() => router.push(`/category/${c.id}`)} style={{ alignItems: 'center', width: 82 }}>
                  <View style={{ width: 68, height: 68, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d6ead9' }}>
                    {c.imageUrl ? <Image source={{ uri: c.imageUrl }} style={{ width: 52, height: 52, borderRadius: 12 }} /> : <T style={{ fontSize: 32 }}>{CATEGORY_ICON[c.name] ?? produceEmoji(c.name)}</T>}
                  </View>
                  <T v="tiny" style={{ color: colors.ink, textAlign: 'center', marginTop: 6 }} numberOfLines={2}>
                    {c.name}
                  </T>
                </Pressable>
              ))}
            </ScrollView>

            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h3">Fresh picks for you</T>
              <Pressable onPress={() => router.navigate('/(customer)/browse')} hitSlop={8}>
                <T style={{ color: colors.primary, fontFamily: font.medium }}>See all</T>
              </Pressable>
            </Row>
            <T v="small" style={{ marginBottom: 10 }}>
              Available for delivery {formatDateLabel(d.deliveryDate).toLowerCase()}
            </T>
            {d.freshPicks.length ? <ProductGrid items={d.freshPicks} width={width} /> : <Empty image={require('../../assets/basket.webp')} title="Restocking" text="Fresh stock is on its way. Check back in a little while." />}

            <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 18, backgroundColor: colors.beige }}>
              <Image source={require('../../assets/farmer.webp')} style={{ width: 60, height: 60 }} contentFit="contain" />
              <View style={{ flex: 1 }}>
                <T v="h3">Not fresh? Don't pay for it.</T>
                <T v="small">Open the box at your door, check every item, and hand back anything you don't like. Cancel any time until it reaches you.</T>
              </View>
            </Card>
          </>
        )}
      </Screen>
      <CartBar />
    </View>
  );
}
