import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { formatINR } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { Card, Empty, Loader, Row, Screen, T, colors, font } from '../../components/ui';

export default function Ledger() {
  const q = useQuery({ queryKey: qk.vendorLedger, queryFn: api.vendor.ledger });
  if (q.isLoading || !q.data) return <Loader />;
  const d = q.data;
  return (
    <Screen edges={[]} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Card style={{ backgroundColor: colors.primary }}>
        <T style={{ color: 'rgba(255,255,255,0.8)' }}>Amount due to you</T>
        <T style={{ color: '#fff', fontFamily: font.bold, fontSize: 28 }}>{formatINR(d.balancePaise)}</T>
        <Row style={{ gap: 20, marginTop: 8 }}>
          <T style={{ color: 'rgba(255,255,255,0.85)' }}>Supplied {formatINR(d.payablePaise)}</T>
          <T style={{ color: 'rgba(255,255,255,0.85)' }}>Paid {formatINR(d.paidPaise)}</T>
        </Row>
      </Card>
      {!d.entries.length ? (
        <Empty title="No transactions yet" />
      ) : (
        <View style={{ gap: 8, marginTop: 14 }}>
          {d.entries.map((e) => (
            <Card key={e.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <T style={{ color: colors.ink, fontFamily: font.medium }}>{e.type === 'PAYABLE' ? `Supplied · ${e.poNo}` : 'Payment received'}</T>
                  <T v="small">
                    {new Date(e.createdAt).toLocaleDateString('en-IN')}
                    {e.reference ? ` · Ref ${e.reference}` : ''}
                  </T>
                </View>
                <T style={{ fontFamily: font.semibold, color: e.type === 'PAYMENT' ? colors.primary : colors.ink }}>
                  {e.type === 'PAYMENT' ? '+ ' : ''}
                  {formatINR(e.amountPaise)}
                </T>
              </Row>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
