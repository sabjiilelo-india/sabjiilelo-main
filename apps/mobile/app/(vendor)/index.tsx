import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { formatDateLabel, formatINR } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { PoBadge } from '../../components/PoBadge';
import { Card, Chip, Empty, Loader, Row, Screen, T, colors, font } from '../../components/ui';

export default function VendorOrders() {
  const { user } = useAuth();
  const [status, setStatus] = useState('SENT');
  const q = useQuery({ queryKey: qk.vendorPos(status), queryFn: () => api.vendor.pos(status || undefined), refetchInterval: 60_000 });
  return (
    <Screen edges={[]} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <T v="tiny">{user?.area?.name}</T>
      <Row style={{ gap: 6, marginVertical: 12 }}>
        <Chip label="New" active={status === 'SENT'} onPress={() => setStatus('SENT')} />
        <Chip label="Accepted" active={status === 'ACCEPTED,ADJUSTED'} onPress={() => setStatus('ACCEPTED,ADJUSTED')} />
        <Chip label="All" active={status === ''} onPress={() => setStatus('')} />
      </Row>
      {q.isLoading ? (
        <Loader />
      ) : !q.data?.length ? (
        <Empty image={require('../../assets/farmer.webp')} title="No orders here" text="New purchase orders from the store show up here." />
      ) : (
        <View style={{ gap: 10 }}>
          {q.data.map((p) => (
            <Card key={p.id} onPress={() => router.push(`/vendor-po/${p.id}`)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T style={{ fontFamily: font.semibold, color: colors.ink }}>{p.poNo}</T>
                <PoBadge status={p.status} />
              </Row>
              <T v="small" style={{ marginTop: 4 }}>
                For {formatDateLabel(p.forDate)} · {p.items.length} items · {formatINR(p.totalPaise)}
              </T>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
