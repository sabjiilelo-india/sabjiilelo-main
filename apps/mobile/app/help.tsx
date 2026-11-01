import { useState } from 'react';
import { LayoutAnimation, Linking, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FAQ_SECTIONS, SUPPORT } from '@sabjiilelo/shared';
import { LinearGradientFallback } from '../components/Hero';
import { Row, Screen, T, colors, font } from '../components/ui';

export default function Help() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const needle = q.trim().toLowerCase();
  const sections = FAQ_SECTIONS.map((s) => ({ ...s, items: s.items.filter((f) => !needle || (f.q + f.a).toLowerCase().includes(needle)) })).filter((s) => s.items.length);

  return (
    <Screen edges={[]}>
      <LinearGradientFallback style={{ borderRadius: 24, padding: 18 }}>
        <T style={{ fontFamily: font.bold, fontSize: 22, color: '#fff' }}>How can we help?</T>
        <T style={{ color: 'rgba(255,255,255,0.8)' }}>{SUPPORT.hours}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, height: 44, marginTop: 14 }}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search questions" placeholderTextColor={colors.muted} style={{ flex: 1, fontFamily: font.regular, color: colors.ink }} />
        </View>
      </LinearGradientFallback>

      <Row style={{ gap: 10, marginTop: 14 }}>
        {[
          { icon: 'call' as const, label: 'Call', color: colors.primary, bg: colors['light-green'], url: SUPPORT.phoneHref },
          { icon: 'logo-whatsapp' as const, label: 'WhatsApp', color: '#128c4a', bg: '#d7f5e3', url: `https://wa.me/${SUPPORT.whatsapp}` },
          { icon: 'mail' as const, label: 'Email', color: '#c25a14', bg: '#ffe9d9', url: `mailto:${SUPPORT.email}` },
        ].map((c) => (
          <Pressable key={c.label} onPress={() => Linking.openURL(c.url)} style={({ pressed }) => ({ flex: 1, alignItems: 'center', backgroundColor: pressed ? colors.cream : '#fff', borderRadius: 18, paddingVertical: 14, borderWidth: 1, borderColor: '#efe8d8' })}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={c.icon} size={21} color={c.color} />
            </View>
            <T style={{ fontFamily: font.medium, color: colors.ink, marginTop: 6 }}>{c.label}</T>
          </Pressable>
        ))}
      </Row>

      {sections.map((s) => (
        <View key={s.title} style={{ marginTop: 20 }}>
          <T v="h3" style={{ marginBottom: 8 }}>
            {s.icon} {s.title}
          </T>
          <View style={{ backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#efe8d8' }}>
            {s.items.map((f, i) => {
              const isOpen = open === f.q || !!needle;
              return (
                <Pressable
                  key={f.q}
                  onPress={() => {
                    LayoutAnimation.easeInEaseOut();
                    setOpen(isOpen ? null : f.q);
                  }}
                  style={{ padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: '#f0eadc' }}
                >
                  <Row style={{ justifyContent: 'space-between', gap: 10 }}>
                    <T style={{ flex: 1, fontFamily: font.medium, color: colors.ink }}>{f.q}</T>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
                  </Row>
                  {isOpen && <T style={{ marginTop: 8 }}>{f.a}</T>}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {!sections.length && (
        <T v="small" style={{ textAlign: 'center', marginTop: 24 }}>
          No answers match "{q}". Reach out to us above.
        </T>
      )}
    </Screen>
  );
}
