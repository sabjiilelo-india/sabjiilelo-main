import { router } from 'expo-router';
import { confirm } from '../components/confirm';
import type { OrderDetail, RazorpayCheckout } from '@sabjiilelo/shared';
import { api } from './api';

/**
 * Starts payment for an order. In mock mode (no Razorpay keys on the server) the user confirms a
 * simulated payment; otherwise the Razorpay checkout opens in a WebView screen.
 */
export async function startPayment(orderId: string, rp: RazorpayCheckout): Promise<OrderDetail | null> {
  if (!rp.mock) {
    router.push({ pathname: '/pay', params: { orderId, checkout: JSON.stringify(rp) } });
    return null;
  }
  const ok = await confirm({
    title: `Pay ₹${(rp.amountPaise / 100).toFixed(2)}`,
    message: 'Test mode: Razorpay keys are not configured yet, so this simulates a successful UPI payment.',
    confirmText: 'Pay now',
    icon: 'card',
  });
  if (!ok) return null;
  const signed = await api.payments.mockCheckout(rp.razorpayOrderId);
  return api.payments.verify({ orderId, ...signed });
}
