import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useShop } from '../../lib/shop';
import { Button, Card, Input, Row, Screen, T, colors, font } from '../../components/ui';
import { toast } from '../../components/toast';

function Item({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <T style={{ flex: 1, color: colors.ink }}>{label}</T>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function Account() {
  const { user, logout, setUser } = useAuth();
  const { area, pincode } = useShop();
  const [name, setName] = useState(user?.name ?? '');
  const save = useMutation({ mutationFn: () => api.auth.updateMe(name), onSuccess: (u) => (setUser(u), toast('Saved')) });
  return (
    <Screen>
      <T v="h1" style={{ marginBottom: 12 }}>
        Account
      </T>
      <Card>
        <Row style={{ gap: 12, marginBottom: 12 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors['light-green'], alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ fontFamily: font.bold, fontSize: 20, color: colors.primary }}>{(user?.name ?? 'U')[0]}</T>
          </View>
          <View>
            <T v="h3">{user?.name ?? 'Add your name'}</T>
            <T v="small">+91 {user?.phone}</T>
          </View>
        </Row>
        <Input label="Your name" value={name} onChangeText={setName} />
        <Button title="Save" variant="secondary" size="sm" loading={save.isPending} disabled={!name.trim() || name === user?.name} onPress={() => save.mutate()} />
      </Card>
      <Card style={{ marginTop: 14, paddingVertical: 4 }}>
        <Item icon="location-outline" label={`Location · ${area?.name ?? ''} ${pincode ?? ''}`} onPress={() => router.push('/location')} />
        <Item icon="home-outline" label="Saved addresses" onPress={() => router.push('/addresses')} />
        <Item icon="receipt-outline" label="My orders" onPress={() => router.push('/(customer)/orders')} />
        <Item icon="notifications-outline" label="Notifications" onPress={() => router.push('/notifications')} />
      </Card>
      <Button
        title="Log out"
        variant="ghost"
        icon="log-out-outline"
        style={{ marginTop: 20 }}
        onPress={async () => {
          await logout();
          router.replace('/login');
        }}
      />
      <T v="script" style={{ textAlign: 'center', marginTop: 20 }}>
        Sabjii le lo, taaza le lo!
      </T>
    </Screen>
  );
}
