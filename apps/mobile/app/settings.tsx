import { Switch, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { ROLE_LABEL } from '@sabjiilelo/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { MenuGroup, MenuRow, useConfirmLogout, useDeleteAccount } from '../components/AccountMenu';
import { Row, Screen, T, colors, font } from '../components/ui';
import { toast } from '../components/toast';

export default function Settings() {
  const { user, setUser } = useAuth();
  const logout = useConfirmLogout();
  const deleteAccount = useDeleteAccount();
  const customer = user?.role === 'CUSTOMER';
  const update = useMutation({
    mutationFn: (patch: { notifyOrders?: boolean; notifyOffers?: boolean }) => api.auth.updateMe(patch),
    onSuccess: (u) => {
      setUser(u);
      toast.success('Preferences saved');
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const sw = (value: boolean, key: 'notifyOrders' | 'notifyOffers') => (
    <Switch value={value} disabled={update.isPending} onValueChange={(v) => update.mutate({ [key]: v })} trackColor={{ true: colors.primary, false: colors.line }} thumbColor="#fff" />
  );

  return (
    <Screen edges={[]}>
      <MenuGroup title="Push notifications">
        <MenuRow icon="cube-outline" label={customer ? 'Order updates' : 'Work updates'} hint={customer ? 'Confirmed, out for delivery, refunds' : 'New assignments and approvals'} right={sw(!!user?.notifyOrders, 'notifyOrders')} last={!customer} />
        {customer && <MenuRow icon="pricetags-outline" label="Offers & deals" hint="Coupons and seasonal specials" right={sw(!!user?.notifyOffers, 'notifyOffers')} last />}
      </MenuGroup>

      <MenuGroup title="Account details">
        <View style={{ padding: 16, gap: 10 }}>
          {[
            ['Mobile', `+91 ${user?.phone ?? ''}`],
            ['Name', user?.name || '—'],
            ['Email', user?.email || '—'],
            ['Role', user ? ROLE_LABEL[user.role] : ''],
            ...(user?.area ? [['Area', user.area.name]] : []),
            ['Member since', user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
          ].map(([k, v]) => (
            <Row key={k} style={{ justifyContent: 'space-between' }}>
              <T v="small">{k}</T>
              <T style={{ fontFamily: font.medium, color: colors.ink }}>{v}</T>
            </Row>
          ))}
        </View>
      </MenuGroup>

      <MenuGroup>
        <MenuRow icon="log-out-outline" label="Log out" onPress={logout} last={!customer} />
        {customer && <MenuRow icon="trash-outline" label="Delete account" hint="Permanently remove your profile" danger onPress={deleteAccount} last />}
      </MenuGroup>
      {!customer && (
        <T v="tiny" style={{ marginTop: 10, textAlign: 'center' }}>
          Staff accounts are managed by your area admin.
        </T>
      )}
    </Screen>
  );
}
