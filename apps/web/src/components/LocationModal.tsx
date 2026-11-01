import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { api } from '../lib/api';
import { useShop } from '../lib/shop';
import { Button, Input, Modal } from './ui';

export function LocationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { setLocation, pincode: current } = useShop();
  const [pincode, setPincode] = useState(current ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setError(null);
    if (!/^\d{6}$/.test(pincode)) return setError('Enter a 6-digit pincode');
    setBusy(true);
    try {
      const r = await api.catalog.serviceability(pincode);
      if (!r.serviceable || !r.area) {
        setError("We're not in your area yet — we're growing fast! Try another pincode.");
      } else {
        setLocation(r.area, pincode);
        onClose();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Where should we deliver?">
      <div className="flex flex-col items-center pb-2 text-center">
        <img src="/icons/house.webp" alt="" className="mb-3 h-20 w-20 object-contain" />
        <p className="mb-5 text-sm text-muted">Enter your pincode to see fresh produce and delivery slots near you.</p>
        <form
          className="flex w-full gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
        >
          <div className="relative flex-1">
            <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
            <Input
              autoFocus
              inputMode="numeric"
              maxLength={6}
              placeholder="e.g. 482001"
              className="pl-9 text-base tracking-widest"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <Button type="submit" loading={busy}>
            Check
          </Button>
        </form>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <p className="mt-4 text-xs text-muted">Now delivering in Jabalpur and Satna</p>
      </div>
    </Modal>
  );
}
