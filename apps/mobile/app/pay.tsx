import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import type { RazorpayCheckout } from '@sabjiilelo/shared';
import { api } from '../lib/api';
import { Loader } from '../components/ui';
import { toast } from '../components/toast';

/** Razorpay Standard Checkout inside a WebView, so it works in Expo Go without a native SDK. */
export default function Pay() {
  const { orderId, checkout } = useLocalSearchParams<{ orderId: string; checkout: string }>();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const rp = JSON.parse(checkout) as RazorpayCheckout;
  const options = {
    key: rp.keyId,
    amount: rp.amountPaise,
    currency: rp.currency,
    name: rp.name,
    description: rp.description,
    order_id: rp.razorpayOrderId,
    prefill: rp.prefill,
    theme: { color: '#0e5a32' },
  };

  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#fbf6ea">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  function send(m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  var rzp = new Razorpay(Object.assign(${JSON.stringify(options)}, {
    handler: function (res) { send({ type: 'success', res: res }); },
    modal: { ondismiss: function () { send({ type: 'dismiss' }); } }
  }));
  rzp.on('payment.failed', function (r) { send({ type: 'failed', error: r.error && r.error.description }); });
  rzp.open();
</script>
</body></html>`;

  async function onMessage(raw: string) {
    const msg = JSON.parse(raw) as { type: string; res?: Record<string, string>; error?: string };
    if (msg.type === 'success' && msg.res) {
      setBusy(true);
      try {
        await api.payments.verify({
          orderId,
          razorpayOrderId: msg.res.razorpay_order_id!,
          razorpayPaymentId: msg.res.razorpay_payment_id!,
          razorpaySignature: msg.res.razorpay_signature!,
        });
        toast('Payment successful');
      } catch (e) {
        toast((e as Error).message);
      }
      qc.invalidateQueries({ queryKey: qk.myOrder(orderId) });
      router.back();
    } else if (msg.type === 'failed') {
      toast(msg.error ?? 'Payment failed');
    } else {
      toast('Payment not completed. You can retry from the order within 15 minutes.');
      router.back();
    }
  }

  if (busy) return <Loader />;
  return <WebView originWhitelist={['*']} source={{ html }} onMessage={(e) => onMessage(e.nativeEvent.data)} javaScriptEnabled startInLoadingState renderLoading={() => <Loader />} />;
}
