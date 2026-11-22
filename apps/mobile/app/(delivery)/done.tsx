import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { api } from '../../lib/api';
import { DeliveryList } from '../../components/DeliveryList';
import { Empty, Screen, SkeletonList } from '../../components/ui';

export default function Done() {
  const q = useQuery({ queryKey: qk.riderOrders('done'), queryFn: () => api.rider.orders('done') });
  return (
    <Screen edges={[]} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {q.isLoading ? <SkeletonList count={3} height={110} /> : q.data?.length ? <DeliveryList orders={q.data} /> : <Empty title="Nothing delivered yet today" />}
    </Screen>
  );
}
