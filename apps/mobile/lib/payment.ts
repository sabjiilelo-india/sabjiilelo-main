import { Alert } from 'react-native';
import { router } from 'expo-router';
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
  const ok = await new Promise<boolean>((resolve) =>
    Alert.alert('Test payment', 'Razorpay keys are not configured yet. Simulate a successful UPI payment?', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Pay', onPress: () => resolve(true) },
    ]),
  );
  if (!ok) return null;
  const signed = await api.payments.mockCheckout(rp.razorpayOrderId);
  return api.payments.verify({ orderId, ...signed });
}
