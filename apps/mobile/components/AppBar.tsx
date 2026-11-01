import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@sabjiilelo/theme';
import { useAuth } from '../lib/auth';
import { useCart } from '../lib/shop';

type IconName = keyof typeof Ionicons.glyphMap;

export function IconButton({ icon, onPress, label, badge, tint = colors.ink }: { icon: IconName; onPress: () => void; label: string; badge?: number; tint?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.beige : 'transparent' })}
    >
      <Ionicons name={icon} size={24} color={tint} />
      {!!badge && (
        <View style={{ position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.cream }}>
          <Text style={{ color: '#fff', fontSize: 10, fontFamily: 'Poppins_600SemiBold' }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Top bar used by every screen: optional back (or close) button, title, optional actions. */
export function AppBar({ title, subtitle, onBack, backIcon = 'arrow-back', right }: { title?: string; subtitle?: string; onBack?: () => void; backIcon?: IconName; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.cream, borderBottomWidth: 1, borderBottomColor: '#eee7d6' }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 4 }}>
        {onBack ? <IconButton icon={backIcon} onPress={onBack} label={backIcon === 'close' ? 'Close' : 'Go back'} /> : <View style={{ width: 8 }} />}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: colors.ink }}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={{ fontFamily: 'Poppins_400Regular', fontSize: 12, color: colors.muted, marginTop: -2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>{right}</View>
      </View>
    </View>
  );
}

/** Where "back" goes when a screen was opened directly (notification, deep link) and has no history. */
function goHome(role: string | undefined) {
  router.replace(role === 'DELIVERY' ? '/(delivery)' : role === 'VENDOR' ? '/(vendor)' : '/(customer)');
}

interface BarProps {
  options: { title?: string; headerTitle?: unknown; presentation?: string; headerRight?: (props: { canGoBack: boolean }) => ReactNode };
  back?: unknown;
  navigation: { goBack: () => void };
}

/** Header for stack screens: always has a back arrow (a close icon for modals, a home icon with no history). */
export function StackBar({ options, back, navigation }: BarProps) {
  const { user } = useAuth();
  const modal = options.presentation === 'modal' || options.presentation === 'formSheet';
  const title = typeof options.headerTitle === 'string' ? options.headerTitle : options.title;
  const right = options.headerRight?.({ canGoBack: false });
  if (back) return <AppBar title={title} backIcon={modal ? 'close' : 'arrow-back'} onBack={() => navigation.goBack()} right={right} />;
  return <AppBar title={title} backIcon="home-outline" onBack={() => goHome(user?.role)} right={right} />;
}

/** Tab-screen header: title only, no back arrow (tabs are top-level destinations). */
export function TabBar({ options }: { options: { title?: string; headerTitle?: unknown; headerRight?: (props: { canGoBack: boolean }) => ReactNode } }) {
  const title = typeof options.headerTitle === 'string' ? options.headerTitle : options.title;
  return <AppBar title={title} right={options.headerRight?.({ canGoBack: false })} />;
}

/** Cart shortcut with item count, for the app bar of browsing screens. */
export function CartButton() {
  const { cart } = useCart();
  const { user } = useAuth();
  if (user?.role !== 'CUSTOMER') return null;
  return <IconButton icon="basket-outline" label="Open cart" badge={cart.itemCount} onPress={() => router.navigate('/(customer)/cart')} />;
}
