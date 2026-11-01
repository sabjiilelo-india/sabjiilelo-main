import { useState } from 'react';
import { View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import type { AreaRef } from '@sabjiilelo/shared';
import { api } from '../lib/api';
import { GeoError, locateMe } from '../lib/geo';
import { useShop } from '../lib/shop';
import { Button, Divider, Input, Screen, T, colors, font } from '../components/ui';
import { toast } from '../components/toast';

export default function Location() {
  const { first } = useLocalSearchParams<{ first?: string }>();
  const { pincode: current, setLocation } = useShop();
  const qc = useQueryClient();
  const [pincode, setPincode] = useState(current ?? '');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function done(area: AreaRef, pin: string) {
    setLocation(area, pin);
    qc.invalidateQueries({ queryKey: ['catalog'] });
    if (first) router.replace('/(customer)');
    else router.back();
  }

  async function check() {
    setError(null);
    if (!/^\d{6}$/.test(pincode)) return setError('Enter a 6-digit pincode');
    setBusy(true);
    try {
      const r = await api.catalog.serviceability(pincode);
      if (!r.serviceable || !r.area) return setError("We're not delivering here yet — coming soon!");
      done(r.area, pincode);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function useCurrent() {
    setError(null);
    setLocating(true);
    try {
      const r = await locateMe();
      if (r.pincode) setPincode(r.pincode);
      if (r.serviceable && r.area && r.pincode) {
        toast.success(`Delivering to ${r.area.name}`, `Pincode ${r.pincode}`);
        return done(r.area, r.pincode);
      }
      setError(
        r.pincode
          ? `We don't deliver to ${r.city ?? 'your area'} (${r.pincode}) yet. We're growing fast!`
          : "We found you, but couldn't tell your pincode. Please type it below.",
      );
    } catch (e) {
      setError(e instanceof GeoError ? e.message : (e as Error).message);
    } finally {
      setLocating(false);
    }
  }

  return (
    <Screen edges={first ? ['top'] : []}>
      <Stack.Screen options={{ headerShown: !first }} />
      <View style={{ alignItems: 'center', marginTop: 16 }}>
        <Image source={require('../assets/house.webp')} style={{ width: 100, height: 100 }} contentFit="contain" />
        <T v="h2" style={{ marginTop: 12 }}>Where should we deliver?</T>
        <T v="small" style={{ textAlign: 'center', marginTop: 4, marginBottom: 20 }}>
          Share your location or enter your pincode to see fresh produce and slots near you.
        </T>
      </View>

      <Button title={locating ? 'Finding you…' : 'Use my current location'} icon="locate" size="lg" loading={locating} onPress={useCurrent} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 }}>
        <View style={{ flex: 1 }}>
          <Divider />
        </View>
        <T v="tiny" style={{ fontFamily: font.medium }}>OR ENTER PINCODE</T>
        <View style={{ flex: 1 }}>
          <Divider />
        </View>
      </View>

      <Input keyboardType="number-pad" maxLength={6} placeholder="e.g. 482001" value={pincode} onChangeText={(t) => setPincode(t.replace(/\D/g, ''))} style={{ fontSize: 20, letterSpacing: 4, textAlign: 'center' }} />
      {error && <T style={{ color: colors.danger, marginBottom: 10, textAlign: 'center' }}>{error}</T>}
      <Button title="Check availability" variant="outline" size="lg" loading={busy} onPress={check} />
      <T v="small" style={{ textAlign: 'center', marginTop: 16 }}>
        Now delivering in Jabalpur and Satna
      </T>
    </Screen>
  );
}
