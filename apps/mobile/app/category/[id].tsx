import { useWindowDimensions, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { api } from '../../lib/api';
import { useShop } from '../../lib/shop';
import { CartBar } from '../../components/CartBar';
import { ProductGrid } from '../../components/ProductCard';
import { Empty, Loader, Screen } from '../../components/ui';

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { area } = useShop();
  const home = useQuery({ queryKey: qk.catalogHome(area?.id ?? ''), queryFn: () => api.catalog.home(area!.id), enabled: !!area });
  const q = useQuery({ queryKey: qk.catalogItems(area?.id ?? '', { categoryId: id }), queryFn: () => api.catalog.items(area!.id, { categoryId: id }), enabled: !!area });
  const name = home.data?.categories.find((c) => c.id === id)?.name ?? 'Category';
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: name }} />
      <Screen edges={[]} refreshing={q.isRefetching} onRefresh={() => q.refetch()} style={{ paddingBottom: 100 }}>
        {q.isLoading ? <Loader /> : q.data?.items.length ? <ProductGrid items={q.data.items} width={width} /> : <Empty title="Nothing here yet" />}
      </Screen>
      <CartBar />
    </View>
  );
}
