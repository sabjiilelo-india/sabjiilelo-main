import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { GeoError, locateMe } from '../lib/geo';
import { useShop } from '../lib/shop';
import { Button, Chip, Input, Row, Screen, T, colors } from '../components/ui';
import { toast } from '../components/toast';

export default function AddressForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const { area, pincode } = useShop();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: qk.addresses, queryFn: api.me.addresses });
  const existing = list.data?.find((a) => a.id === id);
  const [f, setF] = useState({
    label: existing?.label ?? 'Home',
    name: existing?.name ?? user?.name ?? '',
    phone: existing?.phone ?? user?.phone ?? '',
    line1: existing?.line1 ?? '',
    landmark: existing?.landmark ?? '',
    city: existing?.city ?? area?.city ?? '',
    pincode: existing?.pincode ?? pincode ?? '',
    isDefault: existing?.isDefault ?? false,
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  // Fill pincode, city and (if still empty) the street from where the customer is standing.
  async function fillFromGps() {
    setLocating(true);
    try {
      const r = await locateMe();
      setCoords({ lat: r.lat, lng: r.lng });
      setF((s) => ({ ...s, pincode: r.pincode ?? s.pincode, city: r.city ?? s.city, line1: s.line1 || r.line1 || '' }));
      toast.success('Location filled in', r.line1 ? 'Add your house / flat number' : 'Add your house number and street');
    } catch (e) {
      toast.error(e instanceof GeoError ? e.message : 'Could not get your location');
    } finally {
      setLocating(false);
    }
  }
  const save = useMutation({
    mutationFn: () => (id ? api.me.updateAddress(id, { ...f, ...coords }) : api.me.createAddress({ ...f, ...coords })),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: qk.addresses });
      qc.invalidateQueries({ queryKey: ['me', 'quote'] });
      toast(a.serviceable ? 'Address saved' : "Saved, but we don't deliver to this pincode yet");
      router.back();
    },
    onError: (e) => toast((e as Error).message),
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={[]}>
        <Button title={locating ? 'Finding you…' : 'Use my current location'} icon="locate" variant="secondary" loading={locating} onPress={fillFromGps} style={{ marginBottom: 16 }} />
        <Row style={{ gap: 8, marginBottom: 14 }}>
          {['Home', 'Work', 'Other'].map((l) => (
            <Chip key={l} label={l} active={f.label === l} onPress={() => set('label')(l)} />
          ))}
        </Row>
        <Input label="Receiver name" value={f.name} onChangeText={set('name')} />
        <Input label="Phone" keyboardType="number-pad" maxLength={10} value={f.phone} onChangeText={set('phone')} />
        <Input label="House / flat, street, area" value={f.line1} onChangeText={set('line1')} />
        <Input label="Landmark (optional)" value={f.landmark} onChangeText={set('landmark')} />
        <Input label="City" value={f.city} onChangeText={set('city')} />
        <Input label="Pincode" keyboardType="number-pad" maxLength={6} value={f.pincode} onChangeText={set('pincode')} />
        <Row style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <T>Make default address</T>
          <Switch value={f.isDefault} onValueChange={(v) => setF((s) => ({ ...s, isDefault: v }))} trackColor={{ true: colors.primary }} />
        </Row>
        <Button title="Save address" size="lg" loading={save.isPending} onPress={() => save.mutate()} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
