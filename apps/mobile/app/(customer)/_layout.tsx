import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@sabjiilelo/theme';
import { useCart } from '../../lib/shop';
import { CartButton, TabBar } from '../../components/AppBar';

export default function CustomerTabs() {
  const { cart } = useCart();
  return (
    <Tabs
      // Back from any tab returns to Home first, like other shopping apps, then leaves the app.
      backBehavior="firstRoute"
      screenOptions={{
        header: ({ options }) => <TabBar options={options} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: 'Poppins_500Medium', fontSize: 11 },
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen name="index" options={{ headerShown: false, title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color as string} size={size} /> }} />
      <Tabs.Screen name="browse" options={{ title: 'Browse', headerRight: () => <CartButton />, tabBarIcon: ({ color, size }) => <Ionicons name="search" color={color as string} size={size} /> }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          headerTitle: 'My cart',
          tabBarBadge: cart.itemCount || undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent },
          tabBarIcon: ({ color, size }) => <Ionicons name="basket" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen name="orders" options={{ title: 'Orders', headerTitle: 'My orders', tabBarIcon: ({ color, size }) => <Ionicons name="receipt" color={color as string} size={size} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color as string} size={size} /> }} />
    </Tabs>
  );
}
