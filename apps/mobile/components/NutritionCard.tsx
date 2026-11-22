import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dvBar, type Nutrition } from '@sabjiilelo/shared';
import { Card, Row, T, colors, font } from './ui';

/** Nutrition facts and benefits for an item: macros, vitamin and mineral bars, and a few plain-language benefits. */
export function NutritionCard({ nutrition }: { nutrition: Nutrition }) {
  const macros = [
    { l: 'Calories', v: `${nutrition.calories}`, u: 'kcal', bg: '#ffe9d9', fg: '#c25a14' },
    { l: 'Protein', v: `${nutrition.protein}`, u: 'g', bg: '#e0f0fb', fg: '#1d6fa5' },
    { l: 'Carbs', v: `${nutrition.carbs}`, u: 'g', bg: '#fdf1d0', fg: '#a5750a' },
    { l: 'Fibre', v: `${nutrition.fibre}`, u: 'g', bg: colors['light-green'], fg: colors.primary },
  ];
  return (
    <Card style={{ marginTop: 16 }}>
      <Row style={{ gap: 8, marginBottom: 10 }}>
        <Ionicons name="nutrition" size={20} color={colors.primary} />
        <T v="h3">Nutrition & benefits</T>
      </Row>
      <T v="small" style={{ marginBottom: 8 }}>
        Per {nutrition.per}
      </T>

      <Row style={{ gap: 8 }}>
        {macros.map((m) => (
          <View key={m.l} style={{ flex: 1, backgroundColor: m.bg, borderRadius: 14, paddingVertical: 10, alignItems: 'center' }}>
            <T style={{ fontFamily: font.bold, fontSize: 17, color: m.fg }}>
              {m.v}
              <T style={{ fontFamily: font.medium, fontSize: 11, color: m.fg }}> {m.u}</T>
            </T>
            <T v="tiny" style={{ color: m.fg }}>
              {m.l}
            </T>
          </View>
        ))}
      </Row>

      {nutrition.highlights.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <T v="label" style={{ marginBottom: 6 }}>
            Vitamins & minerals
          </T>
          {nutrition.highlights.map((h) => (
            <View key={h.name} style={{ marginBottom: 10 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T style={{ fontFamily: font.medium, color: colors.ink }}>{h.name}</T>
                <T v="small">
                  {h.amount}
                  {h.dv != null ? ` · ${h.dv}% daily value` : ''}
                </T>
              </Row>
              {h.dv != null && (
                <View style={{ height: 7, borderRadius: 4, backgroundColor: colors.beige, marginTop: 5, overflow: 'hidden' }}>
                  <View style={{ width: `${dvBar(h.dv)}%`, height: '100%', borderRadius: 4, backgroundColor: h.dv >= 50 ? colors.primary : colors.leaf }} />
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {nutrition.benefits.length > 0 && (
        <View style={{ marginTop: 6 }}>
          <T v="label" style={{ marginBottom: 6 }}>
            Why it's good for you
          </T>
          {nutrition.benefits.map((b) => (
            <Row key={b} style={{ gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
              <Ionicons name="leaf" size={15} color={colors.leaf} style={{ marginTop: 3 }} />
              <T style={{ flex: 1, color: colors.ink }}>{b}</T>
            </Row>
          ))}
        </View>
      )}

      <T v="tiny" style={{ marginTop: 10 }}>
        Typical values per {nutrition.per}. Actual values vary with variety and ripeness.
      </T>
    </Card>
  );
}
