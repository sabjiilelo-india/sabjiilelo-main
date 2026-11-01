import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { rateUnitLabel, todayIST } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { Button, Card, Loader, Row, Screen, T, colors, font } from '../../components/ui';
import { toast } from '../../components/toast';

export default function Rates() {
  const date = todayIST();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.vendorRates(date), queryFn: () => api.vendor.rates(date) });
  const [edits, setEdits] = useState<Record<string, string>>({});
  useEffect(() => {
    setEdits({});
  }, [q.dataUpdatedAt]);
  const save = useMutation({
    mutationFn: () =>
      api.vendor.saveRates({
        date,
        rates: Object.entries(edits)
          .filter(([, v]) => Number(v) > 0)
          .map(([itemId, v]) => ({ itemId, ratePaise: Math.round(Number(v) * 100) })),
      }),
    onSuccess: (r) => {
      toast(`${r.saved} rates saved`);
      qc.invalidateQueries({ queryKey: qk.vendorRates(date) });
    },
    onError: (e) => toast((e as Error).message),
  });
  if (q.isLoading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()} style={{ paddingBottom: 100 }}>
        <T v="h1">Today's rates</T>
        <T v="small" style={{ marginBottom: 12 }}>
          Quote your mandi price. The store picks the best rates when ordering.
        </T>
        <Card style={{ padding: 0 }}>
          {q.data?.rates.map((r, i) => (
            <Row key={r.itemId} style={{ paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line, gap: 10 }}>
              <T style={{ flex: 1, color: colors.ink, fontFamily: font.medium }}>{r.name}</T>
              <T v="small">₹</T>
              <TextInput
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={colors.muted}
                value={edits[r.itemId] ?? (r.ratePaise != null ? String(r.ratePaise / 100) : '')}
                onChangeText={(t) => setEdits((s) => ({ ...s, [r.itemId]: t }))}
                style={{ width: 80, height: 40, borderWidth: 1, borderColor: edits[r.itemId] !== undefined ? colors.primary : colors.line, borderRadius: 10, paddingHorizontal: 10, fontFamily: font.semibold, color: colors.ink, backgroundColor: '#fff' }}
              />
              <T v="tiny" style={{ width: 44 }}>
                /{rateUnitLabel(r.unitType)}
              </T>
            </Row>
          ))}
        </Card>
      </Screen>
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
        <Button title={`Save ${Object.keys(edits).length || ''} rates`} size="lg" disabled={!Object.keys(edits).length} loading={save.isPending} onPress={() => save.mutate()} />
      </View>
    </View>
  );
}
