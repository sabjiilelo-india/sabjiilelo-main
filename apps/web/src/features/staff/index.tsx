import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { ROLE_LABEL, PRIVACY, TERMS } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Button, Card, Field, Input, PageHeader } from '../../components/ui';
import { toast } from '../../components/toast';
import { SettingsBlock } from '../shop/Account';
import { HelpContent, LegalContent } from '../shop/Help';

/** Profile, settings, help and policies for every staff role (and the super admin). */
export default function StaffAccount({ page }: { page: 'profile' | 'help' | 'terms' | 'privacy' }) {
  if (page === 'help')
    return (
      <>
        <PageHeader title="Help & support" />
        <HelpContent />
      </>
    );
  if (page === 'terms') return <LegalContent doc={TERMS} />;
  if (page === 'privacy') return <LegalContent doc={PRIVACY} />;
  return <StaffProfile />;
}

function StaffProfile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  useEffect(() => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
  }, [user?.name, user?.email]);
  const save = useMutation({
    mutationFn: () => api.auth.updateMe({ name: name.trim(), email: email.trim() || null }),
    onSuccess: (u) => {
      setUser(u);
      toast.success('Profile updated');
    },
    onError: (e) => toast.error('Could not save', (e as Error).message),
  });
  const vendor = useQuery({ queryKey: qk.vendorProfile, queryFn: api.vendor.profile, enabled: user?.role === 'VENDOR' });
  if (!user) return null;
  const dirty = name !== (user.name ?? '') || email !== (user.email ?? '');

  return (
    <>
      <PageHeader title="My profile" subtitle={`${ROLE_LABEL[user.role]}${user.area ? ` · ${user.area.name}` : ''}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-4 bg-gradient-to-br from-primary to-dark-green p-5 text-white">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-bold text-primary">{(user.name ?? 'U')[0]!.toUpperCase()}</span>
              <div>
                <div className="text-lg font-semibold">{user.name}</div>
                <div className="text-sm text-white/80">{user.role === 'SUPERADMIN' ? 'Super admin' : `+91 ${user.phone}`}</div>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <Field label="Full name">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Email (optional)">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </Field>
              <Button loading={save.isPending} disabled={!dirty || !name.trim()} onClick={() => save.mutate()}>
                Save changes
              </Button>
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          {vendor.data && (
            <Card className="p-5 text-sm">
              <h2 className="mb-3 text-base">Business details</h2>
              <dl className="grid grid-cols-[110px_1fr] gap-y-2">
                <dt className="text-muted">Business</dt>
                <dd className="font-medium text-ink">{vendor.data.businessName}</dd>
                <dt className="text-muted">GSTIN</dt>
                <dd className="text-ink">{vendor.data.gstin || '—'}</dd>
                <dt className="text-muted">UPI</dt>
                <dd className="text-ink">{vendor.data.upiId || '—'}</dd>
                <dt className="text-muted">Bank</dt>
                <dd className="text-ink">{vendor.data.bankAccount ? `${vendor.data.bankAccount}${vendor.data.ifsc ? ` · ${vendor.data.ifsc}` : ''}` : '—'}</dd>
              </dl>
              <p className="mt-3 text-xs text-muted">To change payout details, contact your area admin.</p>
            </Card>
          )}
          <SettingsBlock customer={false} />
        </div>
      </div>
    </>
  );
}
