import { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { formatDateLabel, formatINR, formatTime12, type SlotOption } from '@sabjiilelo/shared';
import { api } from '../lib/api';
import { useShop } from '../lib/shop';
import { startPayment } from '../lib/payment';
import { Badge, Button, Card, Divider, Loader, Row, Screen, T, colors, font } from '../components/ui';
import { toast } from '../components/toast';

export default function Checkout() {
  const { area } = useShop();
  const qc = useQueryClient();
  const addresses = useQuery({ queryKey: qk.addresses, queryFn: api.me.addresses });
  const coupons = useQuery({ queryKey: qk.coupons(area?.id ?? ''), queryFn: () => api.me.coupons(area!.id), enabled: !!area });
  const [addressId, setAddressId] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [slot, setSlot] = useState<SlotOption | null>(null);
  const [mode, setMode] = useState<'RAZORPAY' | 'COD'>('COD');
  const [placing, setPlacing] = useState(false);

  const usable = useMemo(() => (addresses.data ?? []).filter((a) => a.serviceable && a.areaId === area?.id), [addresses.data, area]);
  useEffect(() => {
    if (!addressId && usable.length) setAddressId((usable.find((a) => a.isDefault) ?? usable[0]!).id);
  }, [usable, addressId]);

  const quote = useQuery({ queryKey: qk.quote(addressId ?? '', coupon), queryFn: () => api.me.quote(addressId!, coupon), enabled: !!addressId });
  useEffect(() => {
    if (quote.data && (!slot || !quote.data.slots.some((s) => s.slotId === slot.slotId && s.date === slot.date && s.available))) {
      setSlot(quote.data.slots.find((s) => s.available) ?? null);
    }
  }, [quote.data, slot]);
  useEffect(() => {
    if (quote.data?.coupon && !quote.data.coupon.valid) {
      toast(quote.data.coupon.message ?? 'Coupon not valid');
      setCoupon(null);
    }
  }, [quote.data?.coupon]);

  async function place() {
    if (!addressId || !slot) return;
    setPlacing(true);
    try {
      const { order, razorpay } = await api.me.placeOrder({ addressId, slotId: slot.slotId, slotDate: slot.date, couponCode: coupon, paymentMode: mode, channel: 'APP' });
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['catalog'] });
      router.replace(`/order/${order.id}?placed=1`);
      if (razorpay) await startPayment(order.id, razorpay).then(() => qc.invalidateQueries({ queryKey: qk.myOrder(order.id) }));
    } catch (e) {
      toast((e as Error).message);
      quote.refetch();
    } finally {
      setPlacing(false);
    }
  }

  if (addresses.isLoading) return <Loader />;
  const q = quote.data;
  const byDate = new Map<string, SlotOption[]>();
  q?.slots.forEach((s) => byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]));

  return (
    <View style={{ flex: 1 }}>
      <Screen edges={[]} style={{ paddingBottom: 120 }}>
        <Card>
          <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <T v="h3">Deliver to</T>
            <Pressable onPress={() => router.push('/address-form')}>
              <T style={{ color: colors.primary, fontFamily: font.medium }}>+ Add new</T>
            </Pressable>
          </Row>
          {!usable.length ? (
            <T v="small">Add an address in {area?.name} to continue.</T>
          ) : (
            usable.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => setAddressId(a.id)}
                style={{ padding: 10, borderRadius: 12, borderWidth: 2, borderColor: a.id === addressId ? colors.primary : colors.line, backgroundColor: a.id === addressId ? colors.mint : '#fff', marginTop: 6 }}
              >
                <Row style={{ gap: 6 }}>
                  <T style={{ fontFamily: font.semibold, color: colors.ink }}>{a.label}</T>
                  {a.isDefault && <Badge label="Default" tone="green" />}
                </Row>
                <T v="small">
                  {a.name}, {a.line1}, {a.city} – {a.pincode}
                </T>
              </Pressable>
            ))
          )}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <T v="h3" style={{ marginBottom: 6 }}>
            Delivery slot
          </T>
          {quote.isLoading ? (
            <Loader />
          ) : (
            [...byDate].map(([date, list]) => (
              <View key={date} style={{ marginTop: 6 }}>
                <T v="label">{formatDateLabel(date)}</T>
                <Row style={{ gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {list.map((s) => {
                    const sel = slot?.slotId === s.slotId && slot.date === s.date;
                    return (
                      <Pressable
                        key={s.slotId + s.date}
                        disabled={!s.available}
                        onPress={() => setSlot(s)}
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 2, borderColor: sel ? colors.primary : colors.line, backgroundColor: sel ? colors.mint : '#fff', opacity: s.available ? 1 : 0.4 }}
                      >
                        <T style={{ fontFamily: font.semibold, color: sel ? colors.primary : colors.ink }}>{s.label}</T>
                        <T v="tiny">
                          {formatTime12(s.startTime)}–{formatTime12(s.endTime)}
                          {!s.available ? (s.remaining === 0 ? ' · Full' : ' · Closed') : ''}
                        </T>
                      </Pressable>
                    );
                  })}
                </Row>
              </View>
            ))
          )}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <T v="h3" style={{ marginBottom: 8 }}>
            Payment
          </T>
          {[
            { v: 'RAZORPAY' as const, title: 'Pay online', sub: 'UPI, cards, netbanking', icon: 'card' as const },
            { v: 'COD' as const, title: 'Cash on delivery', sub: 'Pay after checking at your door', icon: 'cash' as const },
          ].map((o) => (
            <Pressable key={o.v} onPress={() => setMode(o.v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, borderWidth: 2, borderColor: mode === o.v ? colors.primary : colors.line, marginBottom: 8 }}>
              <Ionicons name={o.icon} size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: font.semibold, color: colors.ink }}>{o.title}</T>
                <T v="small">{o.sub}</T>
              </View>
              {mode === o.v && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
            </Pressable>
          ))}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <T v="h3" style={{ marginBottom: 8 }}>
            Offers
          </T>
          {coupon ? (
            <Row style={{ justifyContent: 'space-between', backgroundColor: colors['light-green'], padding: 10, borderRadius: 10 }}>
              <T style={{ fontFamily: font.semibold, color: colors.primary }}>{coupon} applied</T>
              <Pressable onPress={() => setCoupon(null)}>
                <T style={{ color: colors.danger }}>Remove</T>
              </Pressable>
            </Row>
          ) : (
            <>
              <Row style={{ gap: 8 }}>
                <TextInput
                  value={couponInput}
                  onChangeText={(t) => setCouponInput(t.toUpperCase())}
                  autoCapitalize="characters"
                  placeholder="Coupon code"
                  placeholderTextColor={colors.muted}
                  style={{ flex: 1, height: 42, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, fontFamily: font.regular, color: colors.ink }}
                />
                <Button title="Apply" size="sm" variant="outline" onPress={() => couponInput.trim() && setCoupon(couponInput.trim())} />
              </Row>
              {coupons.data?.map((c) => (
                <Pressable key={c.id} onPress={() => setCoupon(c.code)} style={{ marginTop: 8, padding: 10, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.accent, backgroundColor: '#fff7f0' }}>
                  <T>
                    <T style={{ fontFamily: font.bold, color: '#c25a14' }}>{c.code}</T> · {c.description}
                  </T>
                </Pressable>
              ))}
            </>
          )}
        </Card>

        {q && (
          <Card style={{ marginTop: 12 }}>
            <Line k={`Items (${q.lines.reduce((s, l) => s + l.qty, 0)})`} v={formatINR(q.subtotalPaise)} />
            {q.discountPaise > 0 && <Line k="Coupon discount" v={`– ${formatINR(q.discountPaise)}`} green />}
            <Line k="Delivery fee" v={q.deliveryFeePaise ? formatINR(q.deliveryFeePaise) : 'FREE'} green={!q.deliveryFeePaise} />
            {q.deliveryFeePaise > 0 && q.amountToFreeDeliveryPaise > 0 && <T v="small">Add {formatINR(q.amountToFreeDeliveryPaise)} more for free delivery</T>}
            <Divider />
            <Line k="To pay" v={formatINR(q.totalPaise)} bold />
            {!q.meetsMinOrder && <T style={{ color: colors.danger, marginTop: 6 }}>Minimum order is {formatINR(q.minOrderPaise)}</T>}
          </Card>
        )}
      </Screen>
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
        <Button
          size="lg"
          title={!q ? 'Place order' : mode === 'COD' ? `Place order · ${formatINR(q.totalPaise)}` : `Pay ${formatINR(q.totalPaise)}`}
          loading={placing}
          disabled={!q || !slot || !q.meetsMinOrder || !q.lines.length || q.lines.some((l) => !l.available)}
          onPress={place}
        />
      </View>
    </View>
  );
}

function Line({ k, v, green, bold }: { k: string; v: string; green?: boolean; bold?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginVertical: 3 }}>
      <T style={bold ? { fontFamily: font.semibold, color: colors.ink, fontSize: 16 } : undefined}>{k}</T>
      <T style={{ fontFamily: bold ? font.bold : font.medium, color: green ? colors.primary : colors.ink, fontSize: bold ? 16 : 14 }}>{v}</T>
    </Row>
  );
}
