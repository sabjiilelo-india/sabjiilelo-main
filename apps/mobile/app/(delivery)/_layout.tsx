import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@sabjiilelo/theme';

export default function DeliveryTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: 'Poppins_500Medium', fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Deliveries', tabBarIcon: ({ color, size }) => <Ionicons name="bicycle" color={color} size={size} /> }} />
      <Tabs.Screen name="done" options={{ title: 'Done', tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-done" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Me', tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} /> }} />
    </Tabs>
  );
}
