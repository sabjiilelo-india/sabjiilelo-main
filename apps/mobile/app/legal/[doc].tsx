import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { PRIVACY, TERMS } from '@sabjiilelo/shared';
import { Card, Screen, T } from '../../components/ui';

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const d = doc === 'privacy' ? PRIVACY : TERMS;
  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: d.title }} />
      <Card>
        <T v="h2">{d.title}</T>
        <T v="tiny" style={{ marginTop: 2 }}>
          Last updated {d.updated}
        </T>
        <View style={{ gap: 14, marginTop: 16 }}>
          {d.sections.map((s) => (
            <View key={s.heading}>
              <T v="h3">{s.heading}</T>
              <T style={{ marginTop: 4, lineHeight: 21 }}>{s.body}</T>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
