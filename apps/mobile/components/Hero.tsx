import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@sabjiilelo/theme';

/** Brand green panel with layered circles standing in for the marketing site's gradient. */
export function LinearGradientFallback({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: colors.primary, overflow: 'hidden' }, style]}>
      <View style={{ position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: colors['dark-green'], top: -120, right: -100, opacity: 0.8 }} />
      <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#17803f', bottom: -110, left: -60, opacity: 0.6 }} />
      {children}
    </View>
  );
}
