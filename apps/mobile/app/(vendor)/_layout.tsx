import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@sabjiilelo/theme';
import { TabBar } from '../../components/AppBar';

export default function VendorTabs() {
  return (
    <Tabs
      backBehavior="firstRoute"
      screenOptions={{
        header: ({ options }) => <TabBar options={options} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: 'Poppins_500Medium', fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Orders', headerTitle: 'Purchase orders', tabBarIcon: ({ color, size }) => <Ionicons name="cube" color={color as string} size={size} /> }} />
      <Tabs.Screen name="rates" options={{ title: 'Rates', headerTitle: "Today's rates", tabBarIcon: ({ color, size }) => <Ionicons name="pricetags" color={color as string} size={size} /> }} />
      <Tabs.Screen name="ledger" options={{ title: 'Payments', headerTitle: 'My payments', tabBarIcon: ({ color, size }) => <Ionicons name="wallet" color={color as string} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Me', headerTitle: 'My profile', tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color as string} size={size} /> }} />
    </Tabs>
  );
}
