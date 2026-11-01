import type { OrderDetail, RazorpayCheckout } from '@sabjiilelo/shared';
import { api } from '../../lib/api';

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment page. Check your connection.'));
    document.body.appendChild(s);
  });
}

/**
 * Runs Razorpay Checkout and verifies the payment with the API.
 * In mock mode (no keys on the server) `confirmMock` decides the outcome instead of the real popup.
 */
export async function payWithRazorpay(orderId: string, rp: RazorpayCheckout, confirmMock: () => Promise<boolean>): Promise<OrderDetail | null> {
  if (rp.mock) {
    if (!(await confirmMock())) return null;
    const signed = await api.payments.mockCheckout(rp.razorpayOrderId);
    return api.payments.verify({ orderId, ...signed });
  }
  await loadScript();
  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: rp.keyId,
      amount: rp.amountPaise,
      currency: rp.currency,
      name: rp.name,
      description: rp.description,
      order_id: rp.razorpayOrderId,
      prefill: rp.prefill,
      theme: { color: '#0e5a32' },
      handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          resolve(
            await api.payments.verify({
              orderId,
              razorpayOrderId: r.razorpay_order_id,
              razorpayPaymentId: r.razorpay_payment_id,
              razorpaySignature: r.razorpay_signature,
            }),
          );
        } catch (e) {
          reject(e);
        }
      },
      modal: { ondismiss: () => resolve(null) },
    });
    checkout.open();
  });
}
