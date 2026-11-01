import { useEffect } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { appPathFor, notificationTarget } from '@sabjiilelo/shared';
import { useAuth } from '../lib/auth';

/** Opens the right screen when a push notification is tapped (from the background, or when it launched the app). */
export function NotificationRouter() {
  const { user } = useAuth();
  const last = Notifications.useLastNotificationResponse();
  const id = last?.notification.request.identifier;

  useEffect(() => {
    if (!user || !last) return;
    const href = appPathFor(user.role, notificationTarget(last.notification.request.content.data));
    // Let the navigator finish mounting on a cold start before pushing.
    if (href) setTimeout(() => router.push(href as never), 400);
  }, [id, user?.id]);

  return null;
}
