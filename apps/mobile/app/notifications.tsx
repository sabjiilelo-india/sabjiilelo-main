import { useEffect } from 'react';
import { View } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { router } from 'expo-router';
import { appPathFor, notificationTarget } from '@sabjiilelo/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Card, Empty, Loader, Screen, T, colors, font } from '../components/ui';

export default function Notifications() {
  const { user } = useAuth();
  const open = (data: unknown) => {
    const href = appPathFor(user?.role, notificationTarget(data));
    if (href) router.push(href as never);
  };
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: [...qk.notifications, 'all'],
    queryFn: ({ pageParam }) => api.notifications.list(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  const unread = q.data?.pages[0]?.unread ?? 0;
  useEffect(() => {
    if (unread) api.notifications.markRead().then(() => qc.invalidateQueries({ queryKey: qk.notifications }));
  }, [unread, qc]);
  if (q.isLoading) return <Loader />;
  return (
    <Screen edges={[]} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {!items.length ? (
        <Empty title="All caught up" text="Order updates will appear here." />
      ) : (
        <View style={{ gap: 8 }}>
          {items.map((n) => (
            <Card key={n.id} style={!n.readAt ? { backgroundColor: colors.mint } : undefined} onPress={() => open(n.data)}>
              <T style={{ fontFamily: font.semibold, color: colors.ink }}>{n.title}</T>
              <T>{n.body}</T>
              <T v="tiny" style={{ marginTop: 4 }}>
                {new Date(n.createdAt).toLocaleString('en-IN')}
              </T>
            </Card>
          ))}
          {q.hasNextPage && <Button title="Load older" variant="outline" loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} />}
        </View>
      )}
    </Screen>
  );
}
