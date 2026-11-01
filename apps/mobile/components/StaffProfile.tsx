import type { ReactNode } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ROLE_LABEL } from '@sabjiilelo/shared';
import { useAuth } from '../lib/auth';
import { Button, Card, Row, Screen, T, colors, font } from './ui';

export function StaffProfile({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <Screen>
      <T v="h1" style={{ marginBottom: 12 }}>
        Profile
      </T>
      <Card>
        <Row style={{ gap: 12 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors['light-green'], alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ fontFamily: font.bold, fontSize: 20, color: colors.primary }}>{(user?.name ?? 'U')[0]}</T>
          </View>
          <View>
            <T v="h3">{user?.name}</T>
            <T v="small">
              {user ? ROLE_LABEL[user.role] : ''} · {user?.area?.name}
            </T>
            <T v="small">+91 {user?.phone}</T>
          </View>
        </Row>
      </Card>
      {children}
      <Button
        title="Notifications"
        variant="outline"
        icon="notifications-outline"
        style={{ marginTop: 16 }}
        onPress={() => router.push('/notifications')}
      />
      <Button
        title="Log out"
        variant="ghost"
        icon="log-out-outline"
        style={{ marginTop: 8 }}
        onPress={async () => {
          await logout();
          router.replace('/login');
        }}
      />
    </Screen>
  );
}
