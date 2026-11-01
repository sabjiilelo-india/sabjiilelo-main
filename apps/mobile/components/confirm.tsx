import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@sabjiilelo/theme';

interface Request {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'primary' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  /** User must type this word to enable the confirm button. */
  typeToConfirm?: string;
  /** Extra choices shown as buttons (e.g. cancellation reasons); resolves with the chosen label. */
  options?: string[];
}

type Pending = Request & { resolve: (v: string | boolean) => void };
let open: ((r: Pending) => void) | null = null;

export function confirm(r: Omit<Request, 'options'>): Promise<boolean> {
  return new Promise((resolve) => (open ? open({ ...r, resolve: (v) => resolve(v === true) }) : resolve(false)));
}

/** Bottom sheet with a list of choices; resolves the chosen option or null. */
export function choose(r: Request & { options: string[] }): Promise<string | null> {
  return new Promise((resolve) => (open ? open({ ...r, resolve: (v) => resolve(typeof v === 'string' ? v : null) }) : resolve(null)));
}

export function ConfirmHost() {
  const [req, setReq] = useState<Pending | null>(null);
  const [text, setText] = useState('');
  useEffect(() => {
    open = (r) => {
      setText('');
      setReq(r);
    };
    return () => {
      open = null;
    };
  }, []);
  const close = (v: string | boolean) => {
    req?.resolve(v);
    setReq(null);
  };
  if (!req) return null;
  const danger = req.tone === 'danger';
  const blocked = !!req.typeToConfirm && text.trim().toUpperCase() !== req.typeToConfirm;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => close(false)} statusBarTranslucent>
      <Pressable onPress={() => close(false)} style={{ flex: 1, backgroundColor: 'rgba(11,26,16,0.45)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => undefined} style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 18 }} />
          <View
            style={{
              alignSelf: 'center',
              width: 60,
              height: 60,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: danger ? '#fbe3e3' : colors['light-green'],
            }}
          >
            <Ionicons name={req.icon ?? (danger ? 'warning' : 'help-circle')} size={28} color={danger ? colors.danger : colors.primary} />
          </View>
          <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: colors.ink, textAlign: 'center', marginTop: 14 }}>{req.title}</Text>
          {req.message ? <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13.5, color: colors.muted, textAlign: 'center', marginTop: 6 }}>{req.message}</Text> : null}

          {req.typeToConfirm && (
            <TextInput
              value={text}
              onChangeText={setText}
              autoCapitalize="characters"
              placeholder={`Type ${req.typeToConfirm} to confirm`}
              placeholderTextColor={colors.muted}
              style={{ marginTop: 16, height: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14, fontFamily: 'Poppins_500Medium', color: colors.ink }}
            />
          )}

          {req.options ? (
            <View style={{ marginTop: 16, gap: 8 }}>
              {req.options.map((o) => (
                <Pressable key={o} onPress={() => close(o)} style={({ pressed }) => ({ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: pressed ? colors.cream : '#fff' })}>
                  <Text style={{ fontFamily: 'Poppins_500Medium', color: colors.ink }}>{o}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => close(false)} style={{ padding: 14, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Poppins_600SemiBold', color: colors.muted }}>{req.cancelText ?? 'Go back'}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
              <Pressable onPress={() => close(false)} style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: 'Poppins_600SemiBold', color: colors.ink }}>{req.cancelText ?? 'Cancel'}</Text>
              </Pressable>
              <Pressable
                disabled={blocked}
                onPress={() => close(true)}
                style={{ flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? colors.danger : colors.primary, opacity: blocked ? 0.4 : 1 }}
              >
                <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#fff' }}>{req.confirmText ?? 'Confirm'}</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
