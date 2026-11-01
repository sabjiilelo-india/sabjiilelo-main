import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { formatINR } from '@sabjiilelo/shared';
import { useAuth } from '../../lib/auth';
import { useCart, useShop } from '../../lib/shop';
import { Button, Card, EmptyState, PageLoader } from '../../components/ui';
import { ProduceImage } from '../../components/ProduceImage';
import { Stepper } from './components';

export function CartPage() {
  const { user } = useAuth();
  const { area } = useShop();
  const { cart, isLoading, setQty } = useCart();

  if (!user) {
    return <EmptyState icon="/icons/basket.webp" title="Your basket is waiting" text="Log in to add fresh produce to your cart." action={<Link to="/login?next=/cart"><Button>Login</Button></Link>} />;
  }
  if (isLoading) return <PageLoader />;
  if (!cart.lines.length) {
    return <EmptyState icon="/icons/basket.webp" title="Your cart is empty" text="Fill it up with farm-fresh vegetables and fruits." action={<Link to="/"><Button>Start shopping</Button></Link>} />;
  }
  const savings = cart.lines.reduce((s, l) => s + (l.mrpPaise - l.pricePaise) * l.qty, 0);
  const unavailable = cart.lines.filter((l) => !l.available);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <h1 className="mb-4 text-xl">Your cart · {area?.name}</h1>
        {unavailable.length > 0 && (
          <div className="mb-3 rounded-xl bg-accent/10 px-4 py-3 text-sm text-[#c25a14]">
            {unavailable.map((l) => l.name).join(', ')} {unavailable.length > 1 ? 'are' : 'is'} sold out for the next slot. Reduce or remove to continue.
          </div>
        )}
        <Card className="divide-y divide-line/70">
          {cart.lines.map((l) => (
            <div key={l.variantId} className="flex items-center gap-3 p-4">
              <ProduceImage src={l.image} name={l.name} className="h-16 w-16 shrink-0 rounded-xl" emojiClass="text-3xl" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink">{l.name}</div>
                <div className="text-xs text-muted">{l.variantLabel}</div>
                {!l.available && <div className="text-xs font-medium text-danger">Sold out</div>}
                <div className="mt-1 text-sm font-semibold">
                  {formatINR(l.pricePaise * l.qty)}
                  {l.mrpPaise > l.pricePaise && <span className="ml-2 text-xs font-normal text-muted line-through">{formatINR(l.mrpPaise * l.qty)}</span>}
                </div>
              </div>
              <Stepper qty={l.qty} onChange={(q) => setQty(l.variantId, q)} size="sm" />
              <button onClick={() => setQty(l.variantId, 0)} className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger" aria-label="Remove">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </Card>
      </div>
      <div>
        <Card className="sticky top-24 p-5">
          <h2 className="mb-4 text-base">Bill summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Item total</span>
              <span>{formatINR(cart.subtotalPaise)}</span>
            </div>
            {savings > 0 && (
              <div className="flex justify-between text-primary">
                <span>You save</span>
                <span>{formatINR(savings)}</span>
              </div>
            )}
            <p className="pt-1 text-xs text-muted">Delivery fee and coupons are applied at checkout.</p>
          </div>
          <Link to="/checkout">
            <Button size="lg" block className="mt-5" disabled={unavailable.length > 0}>
              Choose slot & pay
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
