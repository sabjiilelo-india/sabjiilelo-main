import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Card, Input, Screen, T, colors, font } from '../components/ui';
import { toast } from '../components/toast';

export default function EditProfile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const dirty = name !== (user?.name ?? '') || email !== (user?.email ?? '');
  const save = useMutation({
    mutationFn: () => api.auth.updateMe({ name: name.trim(), email: email.trim() || null }),
    onSuccess: (u) => {
      setUser(u);
      toast.success('Profile updated');
      router.back();
    },
    onError: (e) => toast.error('Could not save', (e as Error).message),
  });
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={[]}>
        <View style={{ alignItems: 'center', marginBottom: 18 }}>
          <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ fontFamily: font.bold, fontSize: 34, color: '#fff' }}>{(name || 'U')[0]!.toUpperCase()}</T>
          </View>
        </View>
        <Card>
          <Input label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
          <Input label="Email (optional)" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Input label="Mobile number" value={`+91 ${user?.phone ?? ''}`} editable={false} style={{ backgroundColor: colors.beige, color: colors.muted }} />
          <T v="tiny">Your login number. To change it, contact support.</T>
        </Card>
        <Button title="Save changes" size="lg" style={{ marginTop: 18 }} disabled={!dirty || !name.trim()} loading={save.isPending} onPress={() => save.mutate()} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
