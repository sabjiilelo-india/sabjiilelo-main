import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Caveat_700Bold } from '@expo-google-fonts/caveat';
import { ApiError } from '@sabjiilelo/api-client';
import { colors } from '@sabjiilelo/theme';
import { AuthProvider } from '../lib/auth';
import { ShopProvider } from '../lib/shop';
import { ToastHost } from '../components/toast';
import { CartButton, StackBar } from '../components/AppBar';
import { ConfirmHost } from '../components/confirm';
import { NotificationRouter } from '../components/NotificationRouter';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

export default function RootLayout() {
  const [loaded] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, Caveat_700Bold });
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded]);
  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ShopProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  // One app bar for every pushed screen: back arrow (close icon on modals) + title + actions.
                  header: (p) => <StackBar options={p.options} back={p.back} navigation={p.navigation} />,
                  contentStyle: { backgroundColor: colors.cream },
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="(customer)" options={{ headerShown: false }} />
                <Stack.Screen name="(delivery)" options={{ headerShown: false }} />
                <Stack.Screen name="(vendor)" options={{ headerShown: false }} />
                <Stack.Screen name="location" options={{ presentation: 'modal', title: 'Delivery location' }} />
                <Stack.Screen name="item/[id]" options={{ title: 'Item', headerRight: () => <CartButton /> }} />
                <Stack.Screen name="category/[id]" options={{ title: 'Category', headerRight: () => <CartButton /> }} />
                <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
                <Stack.Screen name="pay" options={{ title: 'Payment', presentation: 'modal' }} />
                <Stack.Screen name="order/[id]" options={{ title: 'Order details' }} />
                <Stack.Screen name="addresses" options={{ title: 'Addresses' }} />
                <Stack.Screen name="address-form" options={{ title: 'Address', presentation: 'modal' }} />
                <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
                <Stack.Screen name="delivery/[id]" options={{ title: 'Delivery' }} />
                <Stack.Screen name="vendor-po/[id]" options={{ title: 'Purchase order' }} />
                <Stack.Screen name="profile" options={{ title: 'Edit profile' }} />
                <Stack.Screen name="settings" options={{ title: 'Settings' }} />
                <Stack.Screen name="help" options={{ title: 'Help & support' }} />
                <Stack.Screen name="legal/[doc]" options={{ title: 'Terms & conditions' }} />
                <Stack.Screen name="about" options={{ title: 'About' }} />
              </Stack>
              <NotificationRouter />
              <ToastHost />
              <ConfirmHost />
            </ShopProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
