import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '@sabjiilelo/theme';

type Kind = 'success' | 'error' | 'info' | 'warning';
interface Item {
  id: number;
  kind: Kind;
  title: string;
  description?: string;
}

let next = 1;
let show: ((t: Item) => void) | null = null;

function push(kind: Kind, title: string, description?: string) {
  show?.({ id: next++, kind, title, description });
}

/** `toast('Saved')` for quick info, or `toast.success(title, description)` etc. */
export const toast = Object.assign((title: string, description?: string) => push(guessKind(title), title, description), {
  success: (title: string, description?: string) => push('success', title, description),
  error: (title: string, description?: string) => push('error', title, description),
  info: (title: string, description?: string) => push('info', title, description),
  warning: (title: string, description?: string) => push('warning', title, description),
});

// Older call sites pass plain messages; pick a sensible style from the wording.
function guessKind(t: string): Kind {
  if (/fail|error|could not|invalid|not |sold out|too many|expired|incorrect/i.test(t)) return 'error';
  if (/saved|done|success|placed|delivered|sent|thanks|cancelled|updated|added/i.test(t)) return 'success';
  return 'info';
}

const STYLE: Record<Kind, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  success: { icon: 'checkmark-circle', color: colors.primary, bg: colors['light-green'] },
  error: { icon: 'close-circle', color: colors.danger, bg: '#fbe3e3' },
  info: { icon: 'information-circle', color: '#1d6fa5', bg: '#e0f0fb' },
  warning: { icon: 'warning', color: '#c25a14', bg: '#ffe9d9' },
};

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<Item | null>(null);
  const y = useRef(new Animated.Value(-120)).current;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    show = (t) => {
      clearTimeout(timer.current);
      setItem(t);
      if (t.kind === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      if (t.kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      y.setValue(-120);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
      timer.current = setTimeout(hide, t.kind === 'error' ? 4500 : 2800);
    };
    return () => {
      show = null;
    };
  }, []);

  function hide() {
    Animated.timing(y, { toValue: -140, duration: 220, useNativeDriver: true }).start(() => setItem(null));
  }

  if (!item) return null;
  const s = STYLE[item.kind];
  return (
    <Animated.View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, zIndex: 1000, transform: [{ translateY: y }] }}>
      <Pressable
        onPress={hide}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: '#fff',
          borderRadius: 18,
          padding: 12,
          borderWidth: 1,
          borderColor: s.bg,
          shadowColor: '#0b1a10',
          shadowOpacity: 0.15,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: s.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={s.icon} size={22} color={s.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Poppins_600SemiBold', color: colors.ink, fontSize: 14 }}>{item.title}</Text>
          {item.description ? <Text style={{ fontFamily: 'Poppins_400Regular', color: colors.muted, fontSize: 12 }}>{item.description}</Text> : null}
        </View>
        <Ionicons name="close" size={18} color={colors.muted} />
      </Pressable>
    </Animated.View>
  );
}
