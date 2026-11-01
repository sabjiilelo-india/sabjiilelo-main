import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { costPaise, formatDateLabel, formatINR, formatQty, fromBaseQty, rateUnitLabel, toBaseQty } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { Button, Card, Empty, Loader, Row, Screen, T, colors, font } from '../../components/ui';
import { toast } from '../../components/toast';
import { PoBadge } from '../../components/PoBadge';

export default function VendorPo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.vendorPo(id), queryFn: () => api.vendor.po(id) });
  const [qty, setQty] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  useEffect(() => {
    if (q.data) setQty(Object.fromEntries(q.data.items.map((i) => [i.id, String(fromBaseQty(i.unitType, i.acceptedQty ?? i.orderedQty))])));
  }, [q.data]);
  const respond = useMutation({
    mutationFn: (action: 'ACCEPT' | 'ADJUST' | 'REJECT') =>
      api.vendor.respond(id, { action, note: note || undefined, items: q.data!.items.map((i) => ({ poItemId: i.id, acceptedQty: toBaseQty(i.unitType, Number(qty[i.id] ?? 0)) })) }),
    onSuccess: (p) => {
      qc.setQueryData(qk.vendorPo(p.id), p);
      qc.invalidateQueries({ queryKey: ['vendor', 'pos'] });
      toast('Response sent to the store');
    },
    onError: (e) => toast((e as Error).message),
  });
  if (q.isLoading) return <Loader />;
  if (!q.data) return <Empty title="Not found" />;
  const p = q.data;
  const editable = ['SENT', 'ACCEPTED', 'ADJUSTED'].includes(p.status);
  const changed = p.items.some((i) => toBaseQty(i.unitType, Number(qty[i.id] ?? 0)) !== i.orderedQty);
  const total = p.items.reduce((s, i) => s + costPaise(i.unitType, toBaseQty(i.unitType, Number(qty[i.id] ?? 0)), i.ratePaise), 0);

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: p.poNo }} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="h3">Deliver for {formatDateLabel(p.forDate)}</T>
          <PoBadge status={p.status} />
        </Row>
        {p.note && <T style={{ marginTop: 6 }}>Note: {p.note}</T>}
      </Card>
      <Card style={{ marginTop: 12, padding: 0 }}>
        {p.items.map((i, idx) => (
          <View key={i.id} style={{ padding: 12, borderTopWidth: idx ? 1 : 0, borderTopColor: colors.line }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T style={{ fontFamily: font.semibold, color: colors.ink }}>{i.name}</T>
              <T v="small">
                {formatINR(i.ratePaise)}/{rateUnitLabel(i.unitType)}
              </T>
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <T v="small">Requested {formatQty(i.unitType, i.orderedQty)}</T>
              {editable ? (
                <Row style={{ gap: 6 }}>
                  <T v="small">You supply</T>
                  <TextInput
                    keyboardType="decimal-pad"
                    value={qty[i.id] ?? ''}
                    onChangeText={(t) => setQty((s) => ({ ...s, [i.id]: t }))}
                    style={{ width: 70, height: 38, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 8, fontFamily: font.semibold, color: colors.ink, backgroundColor: '#fff' }}
                  />
                  <T v="tiny">{rateUnitLabel(i.unitType)}</T>
                </Row>
              ) : (
                <T v="small">Accepted {formatQty(i.unitType, i.acceptedQty ?? 0)}</T>
              )}
            </Row>
          </View>
        ))}
      </Card>
      <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <T v="h3">Order value</T>
        <T style={{ fontFamily: font.bold, fontSize: 18, color: colors.primary }}>{formatINR(editable ? total : p.totalPaise)}</T>
      </Row>
      {editable && (
        <>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Note for the store (optional)"
            placeholderTextColor={colors.muted}
            style={{ marginTop: 12, height: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, fontFamily: font.regular, color: colors.ink, backgroundColor: '#fff' }}
          />
          <Button title={changed ? 'Send adjusted quantities' : 'Accept order'} size="lg" style={{ marginTop: 14 }} loading={respond.isPending} onPress={() => respond.mutate(changed ? 'ADJUST' : 'ACCEPT')} />
          <Button title="Decline" variant="ghost" style={{ marginTop: 6 }} loading={respond.isPending} onPress={() => respond.mutate('REJECT')} />
        </>
      )}
    </Screen>
  );
}
