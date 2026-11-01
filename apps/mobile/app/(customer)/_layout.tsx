import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@sabjiilelo/theme';
import { useCart } from '../../lib/shop';

export default function CustomerTabs() {
  const { cart } = useCart();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: 'Poppins_500Medium', fontSize: 11 },
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="browse" options={{ title: 'Browse', tabBarIcon: ({ color, size }) => <Ionicons name="search" color={color} size={size} /> }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarBadge: cart.itemCount || undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent },
          tabBarIcon: ({ color, size }) => <Ionicons name="basket" color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: ({ color, size }) => <Ionicons name="receipt" color={color} size={size} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} /> }} />
    </Tabs>
  );
}
