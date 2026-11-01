import { View } from 'react-native';
import { Image } from 'expo-image';
import { APP_VERSION, SUPPORT } from '@sabjiilelo/shared';
import { Card, Screen, T, colors } from '../components/ui';

export default function About() {
  return (
    <Screen edges={[]}>
      <Card style={{ alignItems: 'center', backgroundColor: colors.mint }}>
        <Image source={require('../assets/logo.png')} style={{ width: 96, height: 96 }} contentFit="contain" />
        <T v="h1" style={{ marginTop: 8 }}>
          Sabjii Le Lo
        </T>
        <T v="script">Fresh from the farm, every morning</T>
      </Card>
      <Card style={{ marginTop: 14, gap: 10 }}>
        <T>We buy vegetables and fruits fresh from local mandis and farmers every morning, and deliver them to your door in the slot you choose.</T>
        <T>Our freshness promise is simple: check everything at your door and hand back anything that isn't fresh. You never pay for what you don't keep.</T>
        <View style={{ height: 1, backgroundColor: colors.line }} />
        <T v="small">
          {SUPPORT.companyName} · {SUPPORT.address}
        </T>
        <T v="small">Version {APP_VERSION}</T>
      </Card>
    </Screen>
  );
}
