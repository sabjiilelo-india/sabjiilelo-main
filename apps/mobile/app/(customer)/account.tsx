import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { APP_VERSION } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useShop } from '../../lib/shop';
import { MenuGroup, MenuRow, SupportGroup, useConfirmLogout } from '../../components/AccountMenu';
import { LinearGradientFallback } from '../../components/Hero';
import { Row, Screen, T, colors, font } from '../../components/ui';

export default function Account() {
  const { user } = useAuth();
  const { area, pincode } = useShop();
  const logout = useConfirmLogout();
  const orders = useQuery({ queryKey: [...qk.myOrders, 1], queryFn: () => api.me.orders(1) });
  const unread = useQuery({ queryKey: qk.notifications, queryFn: () => api.notifications.list() });
  const since = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '–';

  return (
    <Screen edges={[]} refreshing={orders.isRefetching} onRefresh={() => orders.refetch()}>
      <LinearGradientFallback style={{ borderRadius: 26, padding: 18 }}>
        <Row style={{ gap: 14 }}>
          <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ fontFamily: font.bold, fontSize: 24, color: colors.primary }}>{(user?.name ?? 'U')[0]!.toUpperCase()}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: font.semibold, fontSize: 18, color: '#fff' }} numberOfLines={1}>
              {user?.name || 'Add your name'}
            </T>
            <T style={{ color: 'rgba(255,255,255,0.85)' }}>+91 {user?.phone}</T>
            {user?.email ? (
              <T style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }} numberOfLines={1}>
                {user.email}
              </T>
            ) : null}
          </View>
          <Pressable onPress={() => router.push('/profile')} hitSlop={8} style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, padding: 8 }}>
            <Ionicons name="create-outline" size={20} color="#fff" />
          </Pressable>
        </Row>
        <Row style={{ gap: 10, marginTop: 16 }}>
          {[
            { v: String(orders.data?.total ?? '–'), l: 'Orders' },
            { v: since, l: 'Member since' },
          ].map((s) => (
            <View key={s.l} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, paddingVertical: 10, alignItems: 'center' }}>
              <T style={{ fontFamily: font.bold, fontSize: 17, color: '#fff' }}>{s.v}</T>
              <T style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>{s.l}</T>
            </View>
          ))}
        </Row>
      </LinearGradientFallback>

      {/* Quick tiles, Blinkit-style */}
      <Row style={{ gap: 10, marginTop: 16 }}>
        {[
          { icon: 'receipt-outline' as const, label: 'Orders', to: '/(customer)/orders' as const },
          { icon: 'location-outline' as const, label: 'Addresses', to: '/addresses' as const },
          { icon: 'notifications-outline' as const, label: 'Alerts', to: '/notifications' as const, badge: unread.data?.unread },
        ].map((t) => (
          <Pressable key={t.label} onPress={() => router.push(t.to)} style={({ pressed }) => ({ flex: 1, backgroundColor: pressed ? colors.cream : '#fff', borderRadius: 18, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#efe8d8' })}>
            <View>
              <Ionicons name={t.icon} size={24} color={colors.primary} />
              {!!t.badge && <View style={{ position: 'absolute', top: -2, right: -6, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, borderWidth: 2, borderColor: '#fff' }} />}
            </View>
            <T style={{ fontFamily: font.medium, color: colors.ink, marginTop: 6, fontSize: 13 }}>{t.label}</T>
          </Pressable>
        ))}
      </Row>

      <MenuGroup title="Your account">
        <MenuRow icon="person-outline" label="Edit profile" hint="Name, email" onPress={() => router.push('/profile')} />
        <MenuRow icon="map-outline" label="Delivery location" hint={`${area?.name ?? ''} ${pincode ?? ''}`} onPress={() => router.push('/location')} />
        <MenuRow icon="home-outline" label="Saved addresses" onPress={() => router.push('/addresses')} />
        <MenuRow icon="settings-outline" label="Settings" hint="Notifications, account" onPress={() => router.push('/settings')} last />
      </MenuGroup>

      <SupportGroup />

      <MenuGroup>
        <MenuRow icon="log-out-outline" label="Log out" danger onPress={logout} last />
      </MenuGroup>

      <View style={{ alignItems: 'center', marginTop: 24 }}>
        <Image source={require('../../assets/logo.png')} style={{ width: 54, height: 54 }} contentFit="contain" />
        <T v="script" style={{ marginTop: 4 }}>
          Sabjii le lo, taaza le lo!
        </T>
        <T v="tiny">Version {APP_VERSION}</T>
      </View>
    </Screen>
  );
}
