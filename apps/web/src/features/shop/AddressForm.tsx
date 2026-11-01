import { useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import type { Address } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { GeoError, locateMe } from '../../lib/geo';
import { Button, Field, Input, Modal, Toggle } from '../../components/ui';
import { toast } from '../../components/toast';

export function AddressForm({ open, onClose, address, onSaved }: { open: boolean; onClose: () => void; address?: Address | null; onSaved?: (a: Address) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    label: address?.label ?? 'Home',
    name: address?.name ?? user?.name ?? '',
    phone: address?.phone ?? user?.phone ?? '',
    line1: address?.line1 ?? '',
    landmark: address?.landmark ?? '',
    city: address?.city ?? '',
    pincode: address?.pincode ?? '',
    isDefault: address?.isDefault ?? false,
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  // Fill pincode, city and (if still empty) the street from where the customer is.
  async function fillFromGps() {
    setLocating(true);
    try {
      const r = await locateMe();
      setCoords({ lat: r.lat, lng: r.lng });
      setForm((f) => ({ ...f, pincode: r.pincode ?? f.pincode, city: r.city ?? f.city, line1: f.line1 || r.line1 || '' }));
      toast.success('Location filled in', 'Add your house / flat number to finish.');
    } catch (e) {
      toast.error(e instanceof GeoError ? e.message : 'Could not get your location');
    } finally {
      setLocating(false);
    }
  }
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => (address ? api.me.updateAddress(address.id, { ...form, ...coords }) : api.me.createAddress({ ...form, ...coords })),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: qk.addresses });
      if (!a.serviceable) toast.info("Saved. We don't deliver to this pincode yet.");
      else toast.success('Address saved');
      onSaved?.(a);
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={address ? 'Edit address' : 'Add delivery address'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save address
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Button className="sm:col-span-2" variant="secondary" icon={<LocateFixed size={16} />} loading={locating} onClick={fillFromGps}>
          {locating ? 'Finding you…' : 'Use my current location'}
        </Button>
        <div className="flex gap-2 sm:col-span-2">
          {['Home', 'Work', 'Other'].map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setForm((f) => ({ ...f, label: l }))}
              className={`rounded-full border px-4 py-1.5 text-sm ${form.label === l ? 'border-primary bg-light-green text-primary' : 'border-line text-muted'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <Field label="Receiver name">
          <Input value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Phone">
          <Input inputMode="numeric" maxLength={10} value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label="House / flat, street, area" className="sm:col-span-2">
          <Input value={form.line1} onChange={set('line1')} />
        </Field>
        <Field label="Landmark (optional)" className="sm:col-span-2">
          <Input value={form.landmark ?? ''} onChange={set('landmark')} />
        </Field>
        <Field label="City">
          <Input value={form.city} onChange={set('city')} />
        </Field>
        <Field label="Pincode">
          <Input inputMode="numeric" maxLength={6} value={form.pincode} onChange={set('pincode')} />
        </Field>
        <div className="sm:col-span-2">
          <Toggle checked={form.isDefault} onChange={(v) => setForm((f) => ({ ...f, isDefault: v }))} label="Make this my default address" />
        </div>
      </div>
    </Modal>
  );
}
