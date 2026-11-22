import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '../lib/auth';
import { useShop } from '../lib/shop';

const SPLASH_BG = '#fbf6ea';

/** Splash + role router: each app role has its own tab group. */
export default function Index() {
  const { status, user } = useAuth();
  const { ready, area } = useShop();

  if (status === 'loading' || !ready) {
    return (
      // Same cream background and centred logo as the native splash, so nothing jumps when the app opens.
      <View style={{ flex: 1, backgroundColor: SPLASH_BG, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={require('../assets/logo.png')} style={{ width: 220, height: 220 }} contentFit="contain" />
        <Image
          source={require('../assets/brand-truck.webp')}
          style={{ position: 'absolute', bottom: 72, width: 120, height: 60 }}
          contentFit="contain"
        />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (user.role === 'DELIVERY') return <Redirect href="/(delivery)" />;
  if (user.role === 'VENDOR') return <Redirect href="/(vendor)" />;
  if (!area) return <Redirect href="/location?first=1" />;
  return <Redirect href="/(customer)" />;
}
