import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { api, tokenStore } from '../lib/api';
import { useAuth } from '../lib/auth';
import { T, colors, font } from './ui';
import { confirm } from './confirm';
import { toast } from './toast';

type Icon = keyof typeof Ionicons.glyphMap;

export function MenuRow({ icon, label, hint, onPress, danger, right, last }: { icon: Icon; label: string; hint?: string; onPress?: () => void; danger?: boolean; right?: ReactNode; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 13,
        paddingHorizontal: 14,
        backgroundColor: pressed ? colors.cream : '#fff',
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: '#f0eadc',
      })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? '#fbe3e3' : colors.cream }}>
        <Ionicons name={icon} size={19} color={danger ? colors.danger : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <T style={{ fontFamily: danger ? font.semibold : font.medium, color: danger ? colors.danger : colors.ink }}>{label}</T>
        {hint ? <T v="tiny">{hint}</T> : null}
      </View>
      {right ?? (onPress && !danger ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null)}
    </Pressable>
  );
}

export function MenuGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      {title && (
        <T v="label" style={{ marginBottom: 8, marginLeft: 4 }}>
          {title}
        </T>
      )}
      <View style={{ backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#efe8d8' }}>{children}</View>
    </View>
  );
}

export function useConfirmLogout() {
  const { logout } = useAuth();
  return async () => {
    if (!(await confirm({ title: 'Log out?', message: 'You can sign back in any time with your mobile number.', confirmText: 'Log out', tone: 'danger', icon: 'log-out-outline' }))) return;
    await logout();
    toast.success('Logged out', 'See you again soon!');
    router.replace('/login');
  };
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return async () => {
    const ok = await confirm({
      title: 'Delete your account?',
      message: 'Your profile, saved addresses and cart will be permanently removed. Past invoices are kept for legal reasons.',
      tone: 'danger',
      icon: 'trash',
      confirmText: 'Delete forever',
      typeToConfirm: 'DELETE',
    });
    if (!ok) return;
    try {
      await api.auth.deleteAccount();
      await tokenStore.clear();
      qc.clear();
      toast.success('Account deleted', 'We are sorry to see you go.');
      router.replace('/login');
    } catch (e) {
      toast.error('Could not delete account', (e as Error).message);
    }
  };
}

/** Help, policies and about: identical for customers and staff. */
export function SupportGroup() {
  return (
    <MenuGroup title="Help & information">
      <MenuRow icon="help-buoy-outline" label="Help & support" hint="FAQs, call, WhatsApp" onPress={() => router.push('/help')} />
      <MenuRow icon="document-text-outline" label="Terms & conditions" onPress={() => router.push('/legal/terms')} />
      <MenuRow icon="shield-checkmark-outline" label="Privacy policy" onPress={() => router.push('/legal/privacy')} />
      <MenuRow icon="information-circle-outline" label="About Sabjii Le Lo" onPress={() => router.push('/about')} last />
    </MenuGroup>
  );
}
