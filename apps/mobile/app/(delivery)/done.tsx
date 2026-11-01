import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { api } from '../../lib/api';
import { DeliveryList } from '../../components/DeliveryList';
import { Empty, Loader, Screen, T } from '../../components/ui';

export default function Done() {
  const q = useQuery({ queryKey: qk.riderOrders('done'), queryFn: () => api.rider.orders('done') });
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <T v="h1" style={{ marginBottom: 12 }}>
        Done today
      </T>
      {q.isLoading ? <Loader /> : q.data?.length ? <DeliveryList orders={q.data} /> : <Empty title="Nothing delivered yet today" />}
    </Screen>
  );
}
