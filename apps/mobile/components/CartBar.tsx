import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatINR } from '@sabjiilelo/shared';
import { useCart } from '../lib/shop';
import { colors, font } from './ui';

/** Floating "view cart" bar shown on browsing screens once something is in the cart. */
export function CartBar() {
  const { cart } = useCart();
  if (!cart.itemCount) return null;
  return (
    <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
      <Pressable
        onPress={() => router.navigate('/(customer)/cart')}
        style={{
          backgroundColor: colors.primary,
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          shadowColor: colors.primary,
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        <View>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontFamily: font.regular, fontSize: 12 }}>
            {cart.itemCount} item{cart.itemCount > 1 ? 's' : ''}
          </Text>
          <Text style={{ color: '#fff', fontFamily: font.semibold, fontSize: 16 }}>{formatINR(cart.subtotalPaise)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#fff', fontFamily: font.semibold }}>View cart</Text>
          <Ionicons name="basket" size={20} color="#fff" />
        </View>
      </Pressable>
    </View>
  );
}
