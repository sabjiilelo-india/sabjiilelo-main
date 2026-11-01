import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ORDER_STATUS_LABEL, TRACKING_HEADLINE, TRACKING_STEPS, trackingStepIndex, type OrderStatus } from '@sabjiilelo/shared';
import { T, colors, font } from './ui';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  PLACED: 'receipt-outline',
  CONFIRMED: 'thumbs-up-outline',
  PACKED: 'bag-handle-outline',
  OUT_FOR_DELIVERY: 'bicycle',
  DELIVERED: 'home-outline',
};

function Pulse({ children, active }: { children: React.ReactNode; active: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.55, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 1100, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, scale, opacity]);
  return (
    <View style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
      {active && <Animated.View style={{ position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, opacity, transform: [{ scale }] }} />}
      {children}
    </View>
  );
}

/** Five-step progress tracker with a pulsing marker on the current step. */
export function OrderTracker({ status }: { status: OrderStatus }) {
  const idx = Math.max(0, trackingStepIndex(status));
  const finished = status === 'DELIVERED' || status === 'PARTIALLY_DELIVERED';
  const head = TRACKING_HEADLINE[status];

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.mint, borderRadius: 14, padding: 12, marginTop: 14 }}>
        <Ionicons name={finished ? 'checkmark-circle' : 'time'} size={22} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <T style={{ fontFamily: font.semibold, color: colors.ink }}>{head.title}</T>
          <T v="small">{head.text}</T>
        </View>
      </View>

      <View style={{ flexDirection: 'row', marginTop: 18 }}>
        {TRACKING_STEPS.map((s, i) => {
          const done = i < idx || (finished && i === idx);
          const current = i === idx && !finished;
          return (
            <View key={s} style={{ flex: 1, alignItems: 'center' }}>
              {i > 0 && (
                <View style={{ position: 'absolute', top: 16, left: 0, right: '50%', height: 3, borderRadius: 2, backgroundColor: i <= idx ? colors.primary : colors.line }} />
              )}
              {i < TRACKING_STEPS.length - 1 && (
                <View style={{ position: 'absolute', top: 16, left: '50%', right: 0, height: 3, borderRadius: 2, backgroundColor: i < idx ? colors.primary : colors.line }} />
              )}
              <Pulse active={current}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: done || current ? colors.primary : '#fff',
                    borderWidth: 2,
                    borderColor: done || current ? colors.primary : colors.line,
                  }}
                >
                  <Ionicons name={done ? 'checkmark' : ICONS[s]!} size={done ? 18 : 17} color={done || current ? '#fff' : colors.muted} />
                </View>
              </Pulse>
              <T v="tiny" style={{ textAlign: 'center', marginTop: 6, color: done || current ? colors.primary : colors.muted, fontFamily: current ? font.semibold : font.medium }}>
                {ORDER_STATUS_LABEL[s]}
              </T>
            </View>
          );
        })}
      </View>
    </View>
  );
}
