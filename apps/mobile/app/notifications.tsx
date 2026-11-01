import { useEffect } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { api } from '../lib/api';
import { Card, Empty, Loader, Screen, T, colors, font } from '../components/ui';

export default function Notifications() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.notifications, queryFn: () => api.notifications.list() });
  useEffect(() => {
    if (q.data?.unread) api.notifications.markRead().then(() => qc.invalidateQueries({ queryKey: qk.notifications }));
  }, [q.data?.unread, qc]);
  if (q.isLoading) return <Loader />;
  return (
    <Screen edges={[]} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {!q.data?.data.length ? (
        <Empty title="All caught up" text="Order updates will appear here." />
      ) : (
        <View style={{ gap: 8 }}>
          {q.data.data.map((n) => (
            <Card key={n.id} style={!n.readAt ? { backgroundColor: colors.mint } : undefined}>
              <T style={{ fontFamily: font.semibold, color: colors.ink }}>{n.title}</T>
              <T>{n.body}</T>
              <T v="tiny" style={{ marginTop: 4 }}>
                {new Date(n.createdAt).toLocaleString('en-IN')}
              </T>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
