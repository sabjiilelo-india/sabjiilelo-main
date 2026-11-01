import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { api } from '../lib/api';
import { confirm } from '../components/confirm';
import { Badge, Button, Card, Empty, Loader, Row, Screen, T, colors, font } from '../components/ui';

export default function Addresses() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.addresses, queryFn: api.me.addresses });
  const del = useMutation({ mutationFn: (id: string) => api.me.deleteAddress(id), onSuccess: () => qc.invalidateQueries({ queryKey: qk.addresses }) });
  if (q.isLoading) return <Loader />;
  return (
    <Screen edges={[]}>
      {!q.data?.length ? (
        <Empty image={require('../assets/house.webp')} title="No saved addresses" />
      ) : (
        <View style={{ gap: 10 }}>
          {q.data.map((a) => (
            <Card key={a.id}>
              <Row style={{ gap: 6 }}>
                <T style={{ fontFamily: font.semibold, color: colors.ink }}>{a.label}</T>
                {a.isDefault && <Badge label="Default" tone="green" />}
                {!a.serviceable && <Badge label="Not serviceable" tone="red" />}
                <View style={{ flex: 1 }} />
                <Pressable hitSlop={8} onPress={() => router.push({ pathname: '/address-form', params: { id: a.id } })}>
                  <Ionicons name="create-outline" size={20} color={colors.muted} />
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={async () => (await confirm({ title: 'Delete this address?', message: `${a.label}: ${a.line1}`, tone: 'danger', icon: 'trash', confirmText: 'Delete' })) && del.mutate(a.id)}
                  style={{ marginLeft: 12 }}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.muted} />
                </Pressable>
              </Row>
              <T v="small" style={{ marginTop: 4 }}>
                {a.name} · {a.phone}
                {'\n'}
                {a.line1}
                {a.landmark ? `, ${a.landmark}` : ''}, {a.city} – {a.pincode}
              </T>
            </Card>
          ))}
        </View>
      )}
      <Button title="Add address" icon="add" style={{ marginTop: 16 }} onPress={() => router.push('/address-form')} />
    </Screen>
  );
}
