import { useState } from 'react';
import { ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { api } from '../../lib/api';
import { useShop } from '../../lib/shop';
import { CartBar } from '../../components/CartBar';
import { ProductGrid } from '../../components/ProductCard';
import { Chip, Empty, Loader, Screen, T, colors, font } from '../../components/ui';

export default function Browse() {
  const { width } = useWindowDimensions();
  const { area } = useShop();
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const home = useQuery({ queryKey: qk.catalogHome(area?.id ?? ''), queryFn: () => api.catalog.home(area!.id), enabled: !!area });
  const params = { q: q.trim() || undefined, categoryId };
  const items = useQuery({ queryKey: qk.catalogItems(area?.id ?? '', params), queryFn: () => api.catalog.items(area!.id, params), enabled: !!area });

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={items.isRefetching} onRefresh={() => items.refetch()} style={{ paddingBottom: 100 }}>
        <T v="h1" style={{ marginBottom: 12 }}>
          Browse
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 16, height: 46, borderWidth: 1, borderColor: colors.line }}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search vegetables & fruits"
            placeholderTextColor={colors.muted}
            style={{ flex: 1, fontFamily: font.regular, fontSize: 15, color: colors.ink }}
            returnKeyType="search"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 12 }}>
          <Chip label="All" active={!categoryId} onPress={() => setCategoryId(undefined)} />
          {home.data?.categories.map((c) => (
            <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
          ))}
        </ScrollView>
        {items.isLoading ? (
          <Loader />
        ) : items.data?.items.length ? (
          <ProductGrid items={items.data.items} width={width} />
        ) : (
          <Empty title="No matches" text="Try 'aloo', 'tomato' or 'apple'." />
        )}
      </Screen>
      <CartBar />
    </View>
  );
}
