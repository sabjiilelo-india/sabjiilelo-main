import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '@sabjiilelo/theme';
import { useAuth } from '../lib/auth';
import { useShop } from '../lib/shop';

/** Splash + role router: each app role has its own tab group. */
export default function Index() {
  const { status, user } = useAuth();
  const { ready, area } = useShop();

  if (status === 'loading' || !ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors['dark-green'], alignItems: 'center', justifyContent: 'center' }}>
        <Image source={require('../assets/logo.png')} style={{ width: 160, height: 160 }} contentFit="contain" />
        <Image source={require('../assets/brand-truck.webp')} style={{ width: 120, height: 60, marginTop: 24 }} contentFit="contain" />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (user.role === 'DELIVERY') return <Redirect href="/(delivery)" />;
  if (user.role === 'VENDOR') return <Redirect href="/(vendor)" />;
  if (!area) return <Redirect href="/location?first=1" />;
  return <Redirect href="/(customer)" />;
}
