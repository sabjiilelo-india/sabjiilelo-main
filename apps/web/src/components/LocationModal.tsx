import { useState } from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import { api } from '../lib/api';
import { GeoError, locateMe } from '../lib/geo';
import { useShop } from '../lib/shop';
import { Button, Input, Modal } from './ui';
import { toast } from './toast';

export function LocationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { setLocation, pincode: current } = useShop();
  const [pincode, setPincode] = useState(current ?? '');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
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

  async function useCurrent() {
    setError(null);
    setLocating(true);
    try {
      const r = await locateMe();
      if (r.pincode) setPincode(r.pincode);
      if (r.serviceable && r.area && r.pincode) {
        setLocation(r.area, r.pincode);
        toast.success(`Delivering to ${r.area.name}`, `Pincode ${r.pincode}`);
        onClose();
      } else {
        setError(r.pincode ? `We don't deliver to ${r.city ?? 'your area'} (${r.pincode}) yet. We're growing fast!` : "We found you, but couldn't tell your pincode. Please type it below.");
      }
    } catch (e) {
      setError(e instanceof GeoError ? e.message : (e as Error).message);
    } finally {
      setLocating(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Where should we deliver?">
      <div className="flex flex-col items-center pb-2 text-center">
        <img src="/icons/house.webp" alt="" className="mb-3 h-20 w-20 object-contain" />
        <p className="mb-5 text-sm text-muted">Share your location or enter your pincode to see fresh produce and delivery slots near you.</p>
        <Button size="lg" block icon={<LocateFixed size={18} />} loading={locating} onClick={useCurrent}>
          {locating ? 'Finding you…' : 'Use my current location'}
        </Button>
        <div className="my-4 flex w-full items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-muted">
          <span className="h-px flex-1 bg-line" /> or enter pincode <span className="h-px flex-1 bg-line" />
        </div>
        <form
          className="flex w-full gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
        >
          <div className="relative flex-1">
            <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
            <Input inputMode="numeric" maxLength={6} placeholder="e.g. 482001" className="pl-9 text-base tracking-widest" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))} />
          </div>
          <Button type="submit" variant="outline" loading={busy}>
            Check
          </Button>
        </form>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <p className="mt-4 text-xs text-muted">Now delivering in Jabalpur and Satna</p>
      </div>
    </Modal>
  );
}
