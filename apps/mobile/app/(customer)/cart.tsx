import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatINR } from '@sabjiilelo/shared';
import { useCart } from '../../lib/shop';
import { Button, Card, Empty, Loader, ProduceImage, Row, Screen, Stepper, T, colors, font } from '../../components/ui';

export default function CartTab() {
  const { cart, isLoading, setQty, refetch } = useCart();
  if (isLoading) return <Loader />;
  if (!cart.lines.length) {
    return (
      <Screen edges={[]}>
        <Empty image={require('../../assets/basket.webp')} title="Your cart is empty" text="Fill it with farm-fresh vegetables and fruits." action={<Button title="Start shopping" onPress={() => router.navigate('/(customer)')} />} />
      </Screen>
    );
  }
  const savings = cart.lines.reduce((s, l) => s + (l.mrpPaise - l.pricePaise) * l.qty, 0);
  const blocked = cart.lines.some((l) => !l.available);
  return (
    <View style={{ flex: 1 }}>
      <Screen edges={[]} onRefresh={refetch} style={{ paddingBottom: 120 }}>
        {blocked && (
          <View style={{ backgroundColor: '#ffe9d9', padding: 10, borderRadius: 12, marginBottom: 10 }}>
            <T style={{ color: '#c25a14' }}>Some items are sold out for the next slot. Reduce or remove them to continue.</T>
          </View>
        )}
        <Card style={{ padding: 0 }}>
          {cart.lines.map((l, i) => (
            <Row key={l.variantId} style={{ padding: 12, gap: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
              <ProduceImage uri={l.image} name={l.name} size={56} />
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: font.semibold, color: colors.ink }} numberOfLines={1}>
                  {l.name}
                </T>
                <T v="small">{l.variantLabel}</T>
                {!l.available && <T v="tiny" style={{ color: colors.danger }}>Sold out</T>}
                <T style={{ fontFamily: font.semibold, marginTop: 2 }}>{formatINR(l.pricePaise * l.qty)}</T>
              </View>
              <Stepper qty={l.qty} onChange={(q) => setQty(l.variantId, q)} small />
              <Pressable hitSlop={8} onPress={() => setQty(l.variantId, 0)}>
                <Ionicons name="trash-outline" size={18} color={colors.muted} />
              </Pressable>
            </Row>
          ))}
        </Card>
        <Card style={{ marginTop: 14 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T>Item total</T>
            <T style={{ fontFamily: font.semibold }}>{formatINR(cart.subtotalPaise)}</T>
          </Row>
          {savings > 0 && (
            <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <T style={{ color: colors.primary }}>You save</T>
              <T style={{ color: colors.primary }}>{formatINR(savings)}</T>
            </Row>
          )}
          <T v="small" style={{ marginTop: 8 }}>
            Delivery fee and coupons are applied at checkout.
          </T>
        </Card>
      </Screen>
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
        <Button title={`Choose slot & pay · ${formatINR(cart.subtotalPaise)}`} size="lg" disabled={blocked} onPress={() => router.push('/checkout')} />
      </View>
    </View>
  );
}
