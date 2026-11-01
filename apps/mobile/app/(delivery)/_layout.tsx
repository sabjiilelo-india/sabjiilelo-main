import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@sabjiilelo/theme';
import { TabBar } from '../../components/AppBar';

export default function DeliveryTabs() {
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
      <Tabs.Screen name="index" options={{ title: 'Deliveries', headerTitle: 'My deliveries', tabBarIcon: ({ color, size }) => <Ionicons name="bicycle" color={color as string} size={size} /> }} />
      <Tabs.Screen name="done" options={{ title: 'Done', headerTitle: 'Delivered today', tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-done" color={color as string} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Me', headerTitle: 'My profile', tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color as string} size={size} /> }} />
    </Tabs>
  );
}
