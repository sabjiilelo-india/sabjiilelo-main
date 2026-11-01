import { useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { DOORSTEP_REJECT_REASONS, effectiveLineQty, finalPayable, formatINR, type OrderDetail } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { Button, Card, Chip, Empty, Loader, ProduceImage, Row, Screen, StatusBadge, T, colors, font } from '../../components/ui';
import { PhotoPicker } from '../../components/PhotoPicker';
import { toast } from '../../components/toast';
import { confirm } from '../../components/confirm';

type Rejection = { qty: number; reason: string; photo: string | null };

export default function DeliveryOrder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.riderOrder(id), queryFn: () => api.rider.order(id) });
  const [rej, setRej] = useState<Record<string, Rejection>>({});
  const [cash, setCash] = useState<string | null>(null);
  const update = (o: OrderDetail) => {
    qc.setQueryData(qk.riderOrder(o.id), o);
    qc.invalidateQueries({ queryKey: ['rider'] });
  };
  const start = useMutation({ mutationFn: () => api.rider.start(id), onSuccess: update, onError: (e) => toast((e as Error).message) });
  const deliver = useMutation({
    mutationFn: (payable: number) =>
      api.rider.deliver(id, {
        rejections: Object.entries(rej)
          .filter(([, r]) => r.qty > 0)
          .map(([orderItemId, r]) => ({ orderItemId, qty: r.qty, reason: r.reason, photoUrl: r.photo ?? undefined })),
        codCollectedPaise: cash != null ? Math.round(Number(cash) * 100) : q.data?.paymentMode === 'COD' ? payable : undefined,
      }),
    onSuccess: (o) => {
      update(o);
      toast('Delivered ✅');
      router.back();
    },
    onError: (e) => toast((e as Error).message),
  });

  if (q.isLoading) return <Loader />;
  if (!q.data) return <Empty title="Order not found" />;
  const o = q.data;
  const a = o.address;
  const eff = o.items.reduce((s, i) => s + i.pricePaise * Math.max(0, effectiveLineQty(i) - (rej[i.id]?.qty ?? 0)), 0);
  const payable = finalPayable(eff, o.discountPaise, o.deliveryFeePaise);
  const navUrl = a
    ? a.lat && a.lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${a.line1}, ${a.city} ${a.pincode}`)}`
    : null;

  return (
    <Screen edges={[]}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="h2">#{o.orderNo}</T>
          <StatusBadge status={o.status} />
        </Row>
        <T style={{ fontFamily: font.semibold, color: colors.ink, marginTop: 8 }}>{a?.name}</T>
        <T v="small">
          {a?.line1}
          {a?.landmark ? `, ${a.landmark}` : ''}, {a?.city} – {a?.pincode}
        </T>
        <Row style={{ gap: 10, marginTop: 12 }}>
          {a?.phone && <Button title="Call" icon="call" variant="secondary" size="sm" onPress={() => Linking.openURL(`tel:${a.phone}`)} style={{ flex: 1 }} />}
          {navUrl && <Button title="Navigate" icon="navigate" variant="outline" size="sm" onPress={() => Linking.openURL(navUrl)} style={{ flex: 1 }} />}
        </Row>
      </Card>

      {o.status === 'ASSIGNED' && <Button title="Start delivery" size="lg" icon="bicycle" style={{ marginTop: 16 }} loading={start.isPending} onPress={() => start.mutate()} />}

      {(o.status === 'ASSIGNED' || o.status === 'OUT_FOR_DELIVERY') && (
        <Card style={{ marginTop: 12 }}>
          <T v="h3">{o.status === 'OUT_FOR_DELIVERY' ? 'Check items with the customer' : 'Items'}</T>
          {o.status === 'OUT_FOR_DELIVERY' && <T v="small">If anything isn't fresh, tap − to mark it returned.</T>}
          {o.items.map((i) => {
            const max = effectiveLineQty(i);
            const r = rej[i.id] ?? { qty: 0, reason: DOORSTEP_REJECT_REASONS[0], photo: null };
            const setR = (patch: Partial<Rejection>) => setRej((s) => ({ ...s, [i.id]: { ...r, ...patch } }));
            return (
              <View key={i.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                <Row style={{ gap: 10 }}>
                  <ProduceImage uri={i.image} name={i.name} size={42} />
                  <View style={{ flex: 1 }}>
                    <T style={{ color: colors.ink, fontFamily: font.medium }}>{i.name}</T>
                    <T v="small">
                      {i.variantLabel} × {max}
                    </T>
                  </View>
                  {o.status === 'OUT_FOR_DELIVERY' && (
                    <Row style={{ gap: 8 }}>
                      <T v="tiny">Return</T>
                      <Pressable hitSlop={6} onPress={() => setR({ qty: Math.max(0, r.qty - 1) })}>
                        <Ionicons name="remove-circle-outline" size={26} color={colors.muted} />
                      </Pressable>
                      <T style={{ fontFamily: font.bold, color: r.qty ? colors.danger : colors.ink, width: 18, textAlign: 'center' }}>{r.qty}</T>
                      <Pressable hitSlop={6} onPress={() => setR({ qty: Math.min(max, r.qty + 1) })}>
                        <Ionicons name="add-circle-outline" size={26} color={colors.danger} />
                      </Pressable>
                    </Row>
                  )}
                </Row>
                {r.qty > 0 && (
                  <View style={{ backgroundColor: '#fbe3e3', borderRadius: 12, padding: 10, marginTop: 8 }}>
                    <Row style={{ flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {DOORSTEP_REJECT_REASONS.map((x) => (
                        <Chip key={x} label={x} active={r.reason === x} onPress={() => setR({ reason: x })} />
                      ))}
                    </Row>
                    <PhotoPicker folder="proofs" value={r.photo} onChange={(photo) => setR({ photo })} />
                  </View>
                )}
              </View>
            );
          })}
        </Card>
      )}

      {o.status === 'OUT_FOR_DELIVERY' && (
        <>
          <Card style={{ marginTop: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h3">{o.paymentMode === 'COD' ? 'Collect cash' : 'Prepaid'}</T>
              <T style={{ fontFamily: font.bold, fontSize: 22, color: o.paymentMode === 'COD' ? colors.primary : colors.muted }}>{formatINR(payable)}</T>
            </Row>
            {o.paymentMode === 'COD' && (
              <View style={{ marginTop: 10 }}>
                <T v="label">Cash received (₹)</T>
                <TextInput
                  keyboardType="decimal-pad"
                  value={cash ?? String(payable / 100)}
                  onChangeText={setCash}
                  style={{ marginTop: 6, height: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, fontFamily: font.semibold, fontSize: 18, color: colors.ink, backgroundColor: '#fff' }}
                />
              </View>
            )}
            {o.paymentMode !== 'COD' && payable < o.finalPayablePaise && <T v="small" style={{ marginTop: 6 }}>{formatINR(o.finalPayablePaise - payable)} will be refunded to the customer.</T>}
          </Card>
          <Button title="Mark delivered" size="lg" icon="checkmark-circle" style={{ marginTop: 16 }} loading={deliver.isPending} onPress={async () => (await confirm({ title: 'Mark as delivered?', message: o.paymentMode === 'COD' ? `Confirm you collected ${formatINR(cash != null ? Math.round(Number(cash) * 100) : payable)} in cash.` : 'The customer will be notified right away.', confirmText: 'Delivered', icon: 'checkmark-done' })) && deliver.mutate(payable)} />
        </>
      )}
    </Screen>
  );
}
