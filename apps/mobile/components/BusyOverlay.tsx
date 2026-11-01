import { ActivityIndicator, Modal, View } from 'react-native';
import { Image } from 'expo-image';
import { T, colors } from './ui';

/** Full-screen "working on it" card so slow actions (placing an order) never look frozen. */
export function BusyOverlay({ visible, title, text }: { visible: boolean; title: string; text?: string }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => undefined}>
      <View style={{ flex: 1, backgroundColor: 'rgba(11,26,16,0.55)', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 24, paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center', width: '100%', maxWidth: 320 }}>
          <Image source={require('../assets/truck.webp')} style={{ width: 72, height: 72 }} contentFit="contain" />
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 10 }} />
          <T v="h3" style={{ marginTop: 10, textAlign: 'center' }}>
            {title}
          </T>
          {text ? (
            <T v="small" style={{ marginTop: 4, textAlign: 'center' }}>
              {text}
            </T>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
