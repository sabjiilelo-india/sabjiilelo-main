import { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '@sabjiilelo/theme';
import { ORDER_STATUS_LABEL, produceEmoji, produceTile, type OrderStatus } from '@sabjiilelo/shared';

export { colors };

export const font = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  script: 'Caveat_700Bold',
};

type Variant = 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'tiny' | 'script' | 'label';
const textStyles: Record<Variant, TextStyle> = {
  h1: { fontFamily: font.bold, fontSize: 24, color: colors.ink },
  h2: { fontFamily: font.semibold, fontSize: 19, color: colors.ink },
  h3: { fontFamily: font.semibold, fontSize: 16, color: colors.ink },
  body: { fontFamily: font.regular, fontSize: 14, color: colors.body },
  small: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted },
  tiny: { fontFamily: font.medium, fontSize: 11, color: colors.muted },
  script: { fontFamily: font.script, fontSize: 26, color: colors.primary },
  label: { fontFamily: font.medium, fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
};

export function T({ v = 'body', style, ...rest }: TextProps & { v?: Variant }) {
  return <Text style={[textStyles[v], style]} {...rest} />;
}

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  style,
  padded = true,
  edges = ['top'],
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  edges?: ('top' | 'bottom')[];
}) {
  const inner = padded ? { padding: 16, paddingBottom: 32 } : undefined;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[inner, style]}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent';
const btn: Record<BtnVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: '#fff' },
  accent: { bg: colors.accent, fg: '#fff' },
  secondary: { bg: colors['light-green'], fg: colors.primary },
  outline: { bg: '#fff', fg: colors.ink, border: colors.line },
  ghost: { bg: 'transparent', fg: colors.body },
  danger: { bg: colors.danger, fg: '#fff' },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  size = 'md',
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: BtnVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}) {
  const c = btn[variant];
  const h = size === 'sm' ? 36 : size === 'lg' ? 54 : 46;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          height: h,
          paddingHorizontal: size === 'sm' ? 12 : 18,
          borderRadius: radius.md,
          backgroundColor: c.bg,
          borderWidth: c.border ? 1 : 0,
          borderColor: c.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={c.fg} /> : icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={c.fg} /> : null}
      <Text style={{ color: c.fg, fontFamily: font.semibold, fontSize: size === 'sm' ? 13 : size === 'lg' ? 16 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const base = [s.card, style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...base, pressed && { opacity: 0.9 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

export const Input = forwardRef<TextInput, TextInputProps & { label?: string; error?: string | null }>(function Input({ label, error, style, ...rest }, ref) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label && <T v="label" style={{ marginBottom: 6 }}>{label}</T>}
      <TextInput ref={ref} placeholderTextColor={colors.muted} style={[s.input, style]} {...rest} />
      {error ? <T v="small" style={{ color: colors.danger, marginTop: 4 }}>{error}</T> : null}
    </View>
  );
});

type Tone = 'green' | 'orange' | 'red' | 'gray' | 'blue' | 'yellow';
const tones: Record<Tone, [string, string]> = {
  green: [colors['light-green'], colors.primary],
  orange: ['#ffe9d9', '#c25a14'],
  red: ['#fbe3e3', colors.danger],
  gray: [colors.beige, colors.muted],
  blue: ['#e0f0fb', '#1d6fa5'],
  yellow: ['#fdf1d0', '#a5750a'],
};

export function Badge({ label, tone = 'gray' }: { label: string; tone?: Tone }) {
  const [bg, fg] = tones[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontFamily: font.medium, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

const STATUS_TONE: Record<OrderStatus, Tone> = {
  PAYMENT_PENDING: 'yellow',
  PLACED: 'blue',
  CONFIRMED: 'blue',
  PACKING: 'orange',
  PACKED: 'orange',
  ASSIGNED: 'orange',
  OUT_FOR_DELIVERY: 'orange',
  DELIVERED: 'green',
  PARTIALLY_DELIVERED: 'green',
  CANCELLED: 'red',
};
export const StatusBadge = ({ status }: { status: OrderStatus }) => <Badge label={ORDER_STATUS_LABEL[status]} tone={STATUS_TONE[status]} />;

export function Loader() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function Empty({ title, text, image = require('../assets/leaf.webp'), action }: { title: string; text?: string; image?: number; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', padding: 32 }}>
      <Image source={image} style={{ width: 90, height: 90, marginBottom: 12 }} contentFit="contain" />
      <T v="h3" style={{ textAlign: 'center' }}>{title}</T>
      {text && <T v="small" style={{ textAlign: 'center', marginTop: 4 }}>{text}</T>}
      {action && <View style={{ marginTop: 16 }}>{action}</View>}
    </View>
  );
}

export function ProduceImage({ uri, name, size, style }: { uri?: string | null; name: string; size: number; style?: StyleProp<ViewStyle> }) {
  if (uri) return <Image source={{ uri }} style={[{ width: size, height: size, borderRadius: radius.md }, style as object]} contentFit="cover" transition={150} />;
  return (
    <View style={[{ width: size, height: size, borderRadius: radius.md, backgroundColor: produceTile(name), alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.5 }}>{produceEmoji(name)}</Text>
    </View>
  );
}

export function Stepper({ qty, onChange, max = 50, small }: { qty: number; onChange: (q: number) => void; max?: number; small?: boolean }) {
  const h = small ? 32 : 40;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, height: h, width: small ? 92 : 112, justifyContent: 'space-between' }}>
      <Pressable hitSlop={8} onPress={() => onChange(qty - 1)} style={{ width: 32, alignItems: 'center' }}>
        <Ionicons name="remove" size={18} color="#fff" />
      </Pressable>
      <Text style={{ color: '#fff', fontFamily: font.semibold }}>{qty}</Text>
      <Pressable hitSlop={8} disabled={qty >= max} onPress={() => onChange(qty + 1)} style={{ width: 32, alignItems: 'center', opacity: qty >= max ? 0.4 : 1 }}>
        <Ionicons name="add" size={18} color="#fff" />
      </Pressable>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 10 }} />;
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radius.sm,
        borderWidth: 1.5,
        borderColor: active ? colors.primary : colors.line,
        backgroundColor: active ? colors['light-green'] : '#fff',
      }}
    >
      <Text style={{ fontFamily: font.medium, fontSize: 12, color: active ? colors.primary : colors.muted }}>{label}</Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: '#efe8d8',
    shadowColor: '#0b1a10',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 48,
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.ink,
  },
});
