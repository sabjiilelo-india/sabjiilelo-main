import { useState } from 'react';
import { View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useShop } from '../lib/shop';
import { Button, Input, Screen, T, colors } from '../components/ui';

export default function Location() {
  const { first } = useLocalSearchParams<{ first?: string }>();
  const { pincode: current, setLocation } = useShop();
  const qc = useQueryClient();
  const [pincode, setPincode] = useState(current ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setError(null);
    if (!/^\d{6}$/.test(pincode)) return setError('Enter a 6-digit pincode');
    setBusy(true);
    try {
      const r = await api.catalog.serviceability(pincode);
      if (!r.serviceable || !r.area) return setError("We're not delivering here yet — coming soon!");
      setLocation(r.area, pincode);
      qc.invalidateQueries({ queryKey: ['catalog'] });
      if (first) router.replace('/(customer)');
      else router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={first ? ['top'] : []}>
      <Stack.Screen options={{ headerShown: !first }} />
      <View style={{ alignItems: 'center', marginTop: 24 }}>
        <Image source={require('../assets/house.webp')} style={{ width: 110, height: 110 }} contentFit="contain" />
        <T v="h2" style={{ marginTop: 12 }}>Where should we deliver?</T>
        <T v="small" style={{ textAlign: 'center', marginTop: 4, marginBottom: 24 }}>
          Enter your pincode to see fresh produce and slots near you.
        </T>
      </View>
      <Input autoFocus keyboardType="number-pad" maxLength={6} placeholder="e.g. 482001" value={pincode} onChangeText={(t) => setPincode(t.replace(/\D/g, ''))} style={{ fontSize: 20, letterSpacing: 4, textAlign: 'center' }} />
      {error && <T style={{ color: colors.danger, marginBottom: 10, textAlign: 'center' }}>{error}</T>}
      <Button title="Check availability" size="lg" loading={busy} onPress={check} />
      <T v="small" style={{ textAlign: 'center', marginTop: 16 }}>
        Now delivering in Jabalpur and Satna
      </T>
    </Screen>
  );
}
