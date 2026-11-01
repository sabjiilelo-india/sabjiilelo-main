import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import type { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const expo = new Expo({ accessToken: env.EXPO_ACCESS_TOKEN || undefined });

export interface NotifyInput {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** 'offer' pushes respect the user's offers setting; everything else their order-updates setting. */
  kind?: 'order' | 'offer';
}

/** Channels beyond in-app + push (WhatsApp, SMS) plug in here later. */
interface Channel {
  send(userIds: string[], msg: NotifyInput): Promise<void>;
}

const pushChannel: Channel = {
  async send(userIds, msg) {
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        expoPushToken: { not: null },
        ...(msg.kind === 'offer' ? { notifyOffers: true } : { notifyOrders: true }),
      },
      select: { expoPushToken: true },
    });
    const messages: ExpoPushMessage[] = users
      .map((u) => u.expoPushToken!)
      .filter((t) => Expo.isExpoPushToken(t))
      .map((to) => ({ to, title: msg.title, body: msg.body, data: msg.data, sound: 'default' }));
    for (const chunk of expo.chunkPushNotifications(messages)) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  },
};

const whatsappChannel: Channel = {
  async send() {
    // Not enabled in the MVP. Wire a BSP (Interakt, AiSensy...) here when templates are approved.
  },
};

const channels: Channel[] = [pushChannel, whatsappChannel];

/** Stores the notification in-app and fans out to push. Never throws. */
export async function notify(userIds: (string | null | undefined)[], msg: NotifyInput) {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  if (!ids.length) return;
  try {
    await prisma.notification.createMany({
      data: ids.map((userId) => ({
        userId,
        title: msg.title,
        body: msg.body,
        data: (msg.data ?? undefined) as Prisma.InputJsonValue | undefined,
      })),
    });
    await Promise.allSettled(channels.map((c) => c.send(ids, msg)));
  } catch (err) {
    logger.warn({ err }, 'notify failed');
  }
}
