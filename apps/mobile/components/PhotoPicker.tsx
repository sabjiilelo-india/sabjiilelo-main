import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { api, imageForm } from '../lib/api';
import { T, colors } from './ui';
import { toast } from './toast';

/** Takes a photo with the camera (or picks one) and uploads it, returning the hosted URL. */
export function PhotoPicker({ value, onChange, folder }: { value: string | null; onChange: (url: string | null) => void; folder: 'proofs' | 'issues' }) {
  const [busy, setBusy] = useState(false);

  async function pick() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const result = perm.granted
      ? await ImagePicker.launchCameraAsync({ quality: 0.6, mediaTypes: ['images'] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ['images'] });
    if (result.canceled || !result.assets[0]) return;
    setBusy(true);
    try {
      const { url } = await api.uploads.image(folder, imageForm(result.assets[0].uri));
      onChange(url);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (value) {
    return (
      <View>
        <Image source={{ uri: value }} style={{ width: 84, height: 84, borderRadius: 12 }} />
        <Pressable onPress={() => onChange(null)} style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#fff', borderRadius: 12 }}>
          <Ionicons name="close-circle" size={22} color={colors.danger} />
        </Pressable>
      </View>
    );
  }
  return (
    <Pressable onPress={pick} style={{ width: 84, height: 84, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
      {busy ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="camera" size={24} color={colors.muted} />}
      {!busy && <T v="tiny">Photo</T>}
    </Pressable>
  );
}
