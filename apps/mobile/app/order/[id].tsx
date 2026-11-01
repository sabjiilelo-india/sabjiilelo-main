import { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { choose } from '../../components/confirm';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import {
  ISSUE_TYPE_LABEL,
  effectiveLineQty,
  formatDateLabel,
  formatINR,
  formatTime12,
  type IssueType,
  type OrderDetail,
} from '@sabjiilelo/shared';
import { api, tokenStore } from '../../lib/api';
import { startPayment } from '../../lib/payment';
import { Badge, Button, Card, Chip, Divider, Empty, Loader, ProduceImage, Row, Screen, StatusBadge, T, colors, font } from '../../components/ui';
import { PhotoPicker } from '../../components/PhotoPicker';
import { OrderTracker } from '../../components/OrderTracker';
import { toast } from '../../components/toast';

const CANCEL_REASONS = ['Ordered by mistake', 'Need to change items', 'Will not be home', 'Other'];

export default function OrderScreen() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: qk.myOrder(id),
    queryFn: () => api.me.order(id),
    refetchInterval: (query) => (query.state.data && ['DELIVERED', 'PARTIALLY_DELIVERED', 'CANCELLED'].includes(query.state.data.status) ? false : 20_000),
  });
  const [issueOpen, setIssueOpen] = useState(false);
  const set = (o: OrderDetail) => qc.setQueryData(qk.myOrder(o.id), o);

  const rate = useMutation({ mutationFn: (s: number) => api.me.rate(id, s), onSuccess: (o) => (set(o), toast('Thanks for rating!')) });
  const cancel = useMutation({ mutationFn: (reason: string) => api.me.cancel(id, reason), onSuccess: (o) => (set(o), toast('Order cancelled')), onError: (e) => toast((e as Error).message) });
  const reorder = useMutation({
    mutationFn: () => api.me.reorder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'cart'] });
      router.navigate('/(customer)/cart');
    },
  });

  if (q.isLoading) return <Loader />;
  if (!q.data) return <Empty title="Order not found" />;
  const o = q.data;
  const effSubtotal = o.items.reduce((s, i) => s + i.pricePaise * effectiveLineQty(i), 0);

  return (
    <Screen edges={[]} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {placed && o.status !== 'PAYMENT_PENDING' && o.status !== 'CANCELLED' && (
        <Card style={{ backgroundColor: colors.primary, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={require('../../assets/basket.webp')} style={{ width: 44, height: 44 }} contentFit="contain" />
          <View style={{ flex: 1 }}>
            <T style={{ color: '#fff', fontFamily: font.semibold, fontSize: 16 }}>Order placed! 🎉</T>
            <T style={{ color: 'rgba(255,255,255,0.85)' }}>We'll pick it fresh for your slot.</T>
          </View>
        </Card>
      )}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="h2">#{o.orderNo}</T>
          <StatusBadge status={o.status} />
        </Row>
        {o.slotDate && o.slot && (
          <T v="small" style={{ marginTop: 2 }}>
            {formatDateLabel(o.slotDate)}, {o.slot.label} {formatTime12(o.slot.startTime)}–{formatTime12(o.slot.endTime)}
          </T>
        )}
        {o.status === 'CANCELLED' ? (
          <View style={{ backgroundColor: '#fbe3e3', padding: 10, borderRadius: 10, marginTop: 12 }}>
            <T style={{ color: colors.danger }}>Cancelled{o.cancelReason ? `: ${o.cancelReason}` : ''}</T>
          </View>
        ) : (
          <OrderTracker status={o.status} />
        )}
        {o.riderName && ['ASSIGNED', 'OUT_FOR_DELIVERY'].includes(o.status) && (
          <Row style={{ gap: 10, marginTop: 14, backgroundColor: colors.mint, padding: 10, borderRadius: 12 }}>
            <Image source={require('../../assets/truck.webp')} style={{ width: 36, height: 36 }} contentFit="contain" />
            <T style={{ flex: 1 }}>{o.riderName} is delivering your order.</T>
          </Row>
        )}
        {o.status === 'PAYMENT_PENDING' && o.razorpay && (
          <View style={{ marginTop: 14, backgroundColor: '#fdf1d0', padding: 12, borderRadius: 12 }}>
            <T>Payment pending. Complete it within 15 minutes to confirm.</T>
            <Button
              title={`Pay ${formatINR(o.totalPaise)}`}
              size="sm"
              style={{ marginTop: 8 }}
              onPress={async () => {
                try {
                  const paid = await startPayment(o.id, o.razorpay!);
                  if (paid) set(paid);
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            />
          </View>
        )}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <T v="h3" style={{ marginBottom: 6 }}>
          Items
        </T>
        {o.items.map((i) => {
          const eff = effectiveLineQty(i);
          return (
            <Row key={i.id} style={{ gap: 10, paddingVertical: 8 }}>
              <ProduceImage uri={i.image} name={i.name} size={44} />
              <View style={{ flex: 1 }}>
                <T style={{ color: colors.ink, fontFamily: font.medium }}>{i.name}</T>
                <T v="small">
                  {i.variantLabel} × {i.qty}
                </T>
                {i.packedQty != null && i.packedQty < i.qty && <Badge label={`${i.qty - i.packedQty} unavailable`} tone="orange" />}
                {i.rejectedQty > 0 && <Badge label={`${i.rejectedQty} returned · ${i.rejectReason}`} tone="red" />}
              </View>
              <T style={{ fontFamily: font.semibold }}>{formatINR(i.pricePaise * eff)}</T>
            </Row>
          );
        })}
        <Divider />
        <Line k="Item total" v={formatINR(effSubtotal)} />
        {o.discountPaise > 0 && <Line k={`Coupon ${o.couponCode ?? ''}`} v={`– ${formatINR(Math.min(o.discountPaise, effSubtotal))}`} />}
        <Line k="Delivery fee" v={o.deliveryFeePaise && effSubtotal ? formatINR(o.deliveryFeePaise) : 'FREE'} />
        <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <T style={{ fontFamily: font.semibold, color: colors.ink }}>{o.paymentMode === 'COD' ? (o.codCollectedPaise != null ? 'Paid in cash' : 'Pay on delivery') : 'Paid online'}</T>
          <T style={{ fontFamily: font.bold, color: colors.ink, fontSize: 16 }}>{formatINR(o.codCollectedPaise ?? o.finalPayablePaise)}</T>
        </Row>
      </Card>

      {o.refunds.length > 0 && (
        <Card style={{ marginTop: 12 }}>
          <T v="h3" style={{ marginBottom: 6 }}>
            Refunds
          </T>
          {o.refunds.map((r) => (
            <Row key={r.id} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
              <T style={{ flex: 1 }} numberOfLines={2}>
                {r.reason}
              </T>
              <View style={{ alignItems: 'flex-end' }}>
                <T style={{ fontFamily: font.semibold }}>{formatINR(r.amountPaise)}</T>
                <Badge label={r.status.toLowerCase()} tone={r.status === 'PROCESSED' ? 'green' : r.status === 'REJECTED' ? 'red' : 'yellow'} />
              </View>
            </Row>
          ))}
        </Card>
      )}

      {o.canRate && (
        <Card style={{ marginTop: 12, alignItems: 'center' }}>
          <T v="h3">How fresh was everything?</T>
          <Row style={{ gap: 6, marginTop: 8 }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Pressable key={s} onPress={() => rate.mutate(s)} hitSlop={6}>
                <Ionicons name="star" size={34} color={colors.line} />
              </Pressable>
            ))}
          </Row>
        </Card>
      )}
      {o.rating && (
        <T v="small" style={{ textAlign: 'center', marginTop: 10 }}>
          You rated {'★'.repeat(o.rating.stars)}
        </T>
      )}
      {o.issues.map((i) => (
        <Card key={i.id} style={{ marginTop: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T>
              {ISSUE_TYPE_LABEL[i.type]}
              {i.itemName ? ` · ${i.itemName}` : ''}
            </T>
            <Badge label={i.status.toLowerCase()} tone={i.status === 'APPROVED' ? 'green' : i.status === 'REJECTED' ? 'red' : 'yellow'} />
          </Row>
        </Card>
      ))}

      <View style={{ gap: 8, marginTop: 16 }}>
        {o.invoiceNo && (
          <Button
            title="View bill"
            variant="outline"
            icon="document-text-outline"
            onPress={() => {
              const token = tokenStore.getAccess();
              if (token) WebBrowser.openBrowserAsync(`${api.invoices.url(o.id)}?token=${encodeURIComponent(token)}`).catch(() => toast('Could not open the bill'));
            }}
          />
        )}
        {['DELIVERED', 'PARTIALLY_DELIVERED', 'CANCELLED'].includes(o.status) && <Button title="Order again" variant="secondary" icon="refresh" loading={reorder.isPending} onPress={() => reorder.mutate()} />}
        {o.canReportIssue && <Button title="Report an issue" variant="outline" onPress={() => setIssueOpen(true)} />}
        {o.canCancel && (
          <Button
            title="Cancel order"
            variant="ghost"
            onPress={async () => {
              const reason = await choose({
                title: 'Cancel this order?',
                message: o.paymentStatus === 'PAID' ? 'The full amount goes back to your payment method.' : 'Tell us why — it helps us improve.',
                tone: 'danger',
                icon: 'close-circle',
                cancelText: 'Keep my order',
                options: CANCEL_REASONS,
              });
              if (reason) cancel.mutate(reason);
            }}
          />
        )}
      </View>
      {issueOpen && <IssueSheet order={o} onClose={() => setIssueOpen(false)} onDone={set} />}
    </Screen>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginVertical: 2 }}>
      <T v="small">{k}</T>
      <T>{v}</T>
    </Row>
  );
}

function IssueSheet({ order, onClose, onDone }: { order: OrderDetail; onClose: () => void; onDone: (o: OrderDetail) => void }) {
  const [itemId, setItemId] = useState<string | undefined>(order.items[0]?.id);
  const [type, setType] = useState<IssueType>('QUALITY');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => api.me.reportIssue(order.id, { orderItemId: itemId, type, description: text || undefined, photoUrl: photo ?? undefined }),
    onSuccess: (o) => {
      onDone(o);
      toast("Thanks — we'll review it within a day");
      onClose();
    },
    onError: (e) => toast((e as Error).message),
  });
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(11,26,16,0.4)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <T v="h2">Report an issue</T>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </Row>
          <T v="label">Item</T>
          <Row style={{ flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
            {order.items.map((i) => (
              <Chip key={i.id} label={i.name} active={itemId === i.id} onPress={() => setItemId(i.id)} />
            ))}
          </Row>
          <T v="label">Problem</T>
          <Row style={{ flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
            {(Object.keys(ISSUE_TYPE_LABEL) as IssueType[]).map((k) => (
              <Chip key={k} label={ISSUE_TYPE_LABEL[k]} active={type === k} onPress={() => setType(k)} />
            ))}
          </Row>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Tell us more (optional)"
            placeholderTextColor={colors.muted}
            multiline
            style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.line, minHeight: 70, padding: 12, fontFamily: font.regular, color: colors.ink, marginBottom: 12 }}
          />
          <PhotoPicker folder="issues" value={photo} onChange={setPhoto} />
          <Button title="Submit" style={{ marginTop: 16 }} loading={m.isPending} onPress={() => m.mutate()} />
        </View>
      </View>
    </Modal>
  );
}
