import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { formatINR, type CatalogItem, type Variant } from '@sabjiilelo/shared';
import { useAuth } from '../lib/auth';
import { useCart } from '../lib/shop';
import { Chip, ProduceImage, Stepper, T, colors, font, s } from './ui';

export function discountPct(v: Variant) {
  return v.mrpPaise > v.pricePaise ? Math.round(((v.mrpPaise - v.pricePaise) / v.mrpPaise) * 100) : 0;
}

export function AddButton({ item, variant, small = true }: { item: CatalogItem; variant: Variant; small?: boolean }) {
  const { user } = useAuth();
  const { qtyOf, setQty } = useCart();
  const qty = qtyOf(variant.id);
  const max = Math.floor(item.remainingQty / variant.baseQty);
  const w = small ? 76 : 112;
  const h = small ? 34 : 40;
  if (max <= 0 && qty === 0) {
    return (
      <View style={{ width: w, height: h, borderRadius: 12, backgroundColor: colors.beige, alignItems: 'center', justifyContent: 'center' }}>
        <T v="tiny">Sold out</T>
      </View>
    );
  }
  if (qty > 0) return <Stepper qty={qty} onChange={(q) => setQty(variant.id, q)} max={Math.min(50, max)} small={small} />;
  return (
    <Pressable
      onPress={() => (user ? setQty(variant.id, 1) : router.push('/login'))}
      style={({ pressed }) => ({
        width: w,
        height: h,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.primary,
        backgroundColor: pressed ? colors['light-green'] : '#fff',
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Text style={{ fontFamily: font.bold, color: colors.primary, fontSize: 13 }}>ADD</Text>
    </Pressable>
  );
}

export function ProductCard({ item, width }: { item: CatalogItem; width: number }) {
  const [vi, setVi] = useState(0);
  const v = item.variants[vi] ?? item.variants[0]!;
  const off = discountPct(v);
  return (
    <View style={[s.card, { width, padding: 8, overflow: 'hidden', opacity: item.remainingQty <= 0 ? 0.6 : 1 }]}>
      <Pressable onPress={() => router.push(`/item/${item.id}`)} style={{ borderRadius: 14, overflow: 'hidden' }}>
        <ProduceImage uri={item.images[0]} name={item.name} size={width - 16} style={{ borderRadius: 14, height: (width - 16) * 0.78 }} />
        {off > 0 && (
          <View style={{ position: 'absolute', top: 0, left: 0, backgroundColor: colors.accent, borderBottomRightRadius: 12, paddingHorizontal: 7, paddingVertical: 4 }}>
            <Text style={{ color: '#fff', fontFamily: font.bold, fontSize: 10, lineHeight: 12 }}>{off}%{'\n'}OFF</Text>
          </View>
        )}
      </Pressable>
      <View style={{ paddingTop: 8, paddingHorizontal: 2 }}>
        <View style={{ alignSelf: 'flex-start', backgroundColor: item.sourceNote ? colors.mint : colors.beige, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4, maxWidth: '100%' }}>
          <T v="tiny" style={{ color: item.sourceNote ? colors.primary : colors.muted }} numberOfLines={1}>
            {item.sourceNote ? `🌱 ${item.sourceNote}` : 'Fresh today'}
          </T>
        </View>
        <Pressable onPress={() => router.push(`/item/${item.id}`)}>
          <T style={{ fontFamily: font.semibold, color: colors.ink, minHeight: 38, fontSize: 13.5, lineHeight: 19 }} numberOfLines={2}>
            {item.name}
          </T>
        </Pressable>
        {item.variants.length > 1 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {item.variants.map((x, i) => (
              <Chip key={x.id} label={x.label} active={i === vi} onPress={() => setVi(i)} />
            ))}
          </View>
        ) : (
          <T v="small" style={{ marginTop: 6 }}>
            {v.label}
          </T>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10, gap: 4 }}>
          <View>
            <T style={{ fontFamily: font.bold, color: colors.ink, fontSize: 15 }}>{formatINR(v.pricePaise)}</T>
            {off > 0 && <T v="tiny" style={{ textDecorationLine: 'line-through' }}>{formatINR(v.mrpPaise)}</T>}
          </View>
          <AddButton item={item} variant={v} />
        </View>
      </View>
    </View>
  );
}

export function ProductGrid({ items, width }: { items: CatalogItem[]; width: number }) {
  const cardW = (width - 16 * 2 - 12) / 2;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {items.map((i) => (
        <ProductCard key={i.id} item={i} width={cardW} />
      ))}
    </View>
  );
}
