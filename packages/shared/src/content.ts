/** Customer-facing content shared by web and mobile: support contacts, FAQs and policies. */

export const SUPPORT = {
  phone: '+91 90000 00000',
  phoneHref: 'tel:+919000000000',
  whatsapp: '919000000000',
  email: 'support@sabjiilelo.in',
  hours: 'Every day, 6 AM – 9 PM',
  companyName: 'Sabjii Le Lo',
  address: 'Napier Town, Jabalpur, Madhya Pradesh 482001',
};

export const APP_VERSION = '1.0.0';

export interface Faq {
  q: string;
  a: string;
}

export const FAQ_SECTIONS: { title: string; icon: string; items: Faq[] }[] = [
  {
    title: 'Orders & delivery',
    icon: '🚚',
    items: [
      {
        q: 'When will my order arrive?',
        a: 'You choose a delivery slot at checkout — for example Tomorrow 7–10 AM or Today 5–8 PM. Our delivery partner arrives within that window.',
      },
      {
        q: 'Until when can I order for a slot?',
        a: 'Each slot closes a few hours before it starts so we can buy fresh from the mandi. The checkout only shows slots that are still open.',
      },
      {
        q: 'Can I change or cancel my order?',
        a: 'You can cancel for free from the order page until the slot cutoff. After that, please contact support and we will try our best to help.',
      },
      {
        q: 'Which areas do you deliver to?',
        a: 'We currently deliver in Jabalpur and Satna. Enter your pincode on the home page to check availability.',
      },
    ],
  },
  {
    title: 'Freshness promise & returns',
    icon: '🌱',
    items: [
      {
        q: 'What is the freshness promise?',
        a: 'Check every item at your door. If anything is not fresh, hand it back to the delivery partner and it comes off your bill immediately.',
      },
      {
        q: 'I found a problem after the delivery partner left.',
        a: 'Open the order and tap "Report an issue" within 24 hours, with a photo if possible. Our team reviews it and refunds approved amounts.',
      },
      {
        q: 'Why is the weight sometimes slightly different?',
        a: 'Fresh produce varies naturally. We pack as close to the pack size as possible; if an item is short or unavailable, you are only charged for what we deliver.',
      },
    ],
  },
  {
    title: 'Payments & refunds',
    icon: '💳',
    items: [
      {
        q: 'Which payment methods are accepted?',
        a: 'UPI, cards and netbanking through Razorpay, or cash on delivery.',
      },
      {
        q: 'How long do refunds take?',
        a: 'Refunds to UPI, cards or netbanking usually reach you in 3–5 working days. Cash-on-delivery orders are simply billed less at the door.',
      },
      {
        q: 'Do coupons stack?',
        a: 'One coupon per order. Offers available in your area are listed at checkout.',
      },
    ],
  },
  {
    title: 'Account',
    icon: '👤',
    items: [
      {
        q: 'How do I log in?',
        a: 'Use your mobile number and the OTP we send. No password needed.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Go to Account → Settings → Delete account. Your personal details and saved addresses are removed. Past invoices are kept as required by law.',
      },
    ],
  },
];

export interface LegalDoc {
  title: string;
  updated: string;
  sections: { heading: string; body: string }[];
}

export const TERMS: LegalDoc = {
  title: 'Terms & Conditions',
  updated: '1 November 2026',
  sections: [
    {
      heading: '1. About these terms',
      body: 'These terms apply to your use of the Sabjii Le Lo website and app and to every order you place. By placing an order you agree to them.',
    },
    {
      heading: '2. Orders',
      body: 'An order is confirmed once you receive an order number. Fresh produce is subject to daily availability; if an item cannot be supplied it is removed from your bill and, for prepaid orders, refunded.',
    },
    {
      heading: '3. Prices',
      body: 'Prices change daily with mandi rates. The price shown at checkout is the price you pay. Delivery fees and minimum order values are shown before you pay.',
    },
    {
      heading: '4. Delivery',
      body: 'We deliver in the slot you choose. Please make sure someone is available to receive the order. Repeated failed deliveries may lead to cash on delivery being disabled for the account.',
    },
    {
      heading: '5. Freshness promise and returns',
      body: 'You may return any item at the door if it is not fresh, and you will not be charged for it. Issues found later must be reported within 24 hours of delivery through the app or website.',
    },
    {
      heading: '6. Cancellations and refunds',
      body: 'You may cancel free of charge before the slot cutoff. Refunds for prepaid orders go back to the original payment method, normally within 3–5 working days.',
    },
    {
      heading: '7. Your account',
      body: 'Keep your phone number up to date and do not share OTPs. You can delete your account at any time from Settings.',
    },
    {
      heading: '8. Contact',
      body: `Questions about these terms: ${SUPPORT.email}.`,
    },
  ],
};

export const PRIVACY: LegalDoc = {
  title: 'Privacy Policy',
  updated: '1 November 2026',
  sections: [
    {
      heading: 'What we collect',
      body: 'Your mobile number, name, email (optional), delivery addresses, order history, and payment status. We do not store card or UPI details — payments are handled by Razorpay.',
    },
    {
      heading: 'Why we use it',
      body: 'To deliver your orders, send order updates, handle refunds and support requests, and improve our service. With your permission we may also send offers, which you can turn off in Settings.',
    },
    {
      heading: 'Who we share it with',
      body: 'Only with the people who need it to serve you: our delivery partner for your order, and our payment and messaging providers. We never sell your data.',
    },
    {
      heading: 'How long we keep it',
      body: 'While your account is active. When you delete your account we remove your personal details and addresses; invoices are retained as required by tax law.',
    },
    {
      heading: 'Your choices',
      body: 'You can edit your profile, manage notifications, and delete your account from Settings at any time.',
    },
    {
      heading: 'Contact',
      body: `For privacy questions write to ${SUPPORT.email}.`,
    },
  ],
};
