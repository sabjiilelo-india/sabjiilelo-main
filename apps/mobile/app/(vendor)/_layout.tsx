import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@sabjiilelo/theme';

export default function VendorTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: 'Poppins_500Medium', fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Orders', tabBarIcon: ({ color, size }) => <Ionicons name="cube" color={color} size={size} /> }} />
      <Tabs.Screen name="rates" options={{ title: 'Rates', tabBarIcon: ({ color, size }) => <Ionicons name="pricetags" color={color} size={size} /> }} />
      <Tabs.Screen name="ledger" options={{ title: 'Payments', tabBarIcon: ({ color, size }) => <Ionicons name="wallet" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Me', tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} /> }} />
    </Tabs>
  );
}
