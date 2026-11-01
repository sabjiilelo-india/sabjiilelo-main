import type { ReactNode } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ROLE_LABEL } from '@sabjiilelo/shared';
import { useAuth } from '../lib/auth';
import { MenuGroup, MenuRow, SupportGroup, useConfirmLogout } from './AccountMenu';
import { LinearGradientFallback } from './Hero';
import { Row, Screen, T, colors, font } from './ui';

/** "Me" tab for delivery partners and vendors. */
export function StaffProfile({ children }: { children?: ReactNode }) {
  const { user } = useAuth();
  const logout = useConfirmLogout();
  return (
    <Screen edges={[]}>
      <LinearGradientFallback style={{ borderRadius: 26, padding: 18 }}>
        <Row style={{ gap: 14 }}>
          <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ fontFamily: font.bold, fontSize: 24, color: colors.primary }}>{(user?.name ?? 'U')[0]!.toUpperCase()}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: font.semibold, fontSize: 18, color: '#fff' }}>{user?.name}</T>
            <T style={{ color: 'rgba(255,255,255,0.85)' }}>
              {user ? ROLE_LABEL[user.role] : ''} · {user?.area?.name}
            </T>
            <T style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>+91 {user?.phone}</T>
          </View>
        </Row>
      </LinearGradientFallback>
      {children}
      <MenuGroup title="Your account">
        <MenuRow icon="person-outline" label="Edit profile" hint="Name, email" onPress={() => router.push('/profile')} />
        <MenuRow icon="notifications-outline" label="Notifications" onPress={() => router.push('/notifications')} />
        <MenuRow icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} last />
      </MenuGroup>
      <SupportGroup />
      <MenuGroup>
        <MenuRow icon="log-out-outline" label="Log out" danger onPress={logout} last />
      </MenuGroup>
    </Screen>
  );
}
