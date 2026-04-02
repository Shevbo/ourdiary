import webpush from "web-push";
import { prisma } from "./prisma";

let vapidReady = false;

function configureVapid(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:noreply@ourdiary.local";
  if (!publicKey || !privateKey) return false;
  if (!vapidReady) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidReady = true;
  }
  return true;
}

export function isWebPushConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export type PushPayload = { title: string; body: string; url?: string };

export async function notifySubscribers(payload: PushPayload, options?: { exceptUserId?: string }) {
  if (!configureVapid()) return;

  const where = options?.exceptUserId
    ? { userId: { not: options.exceptUserId } }
    : {};

  const subs = await prisma.pushSubscription.findMany({ where });
  const data = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        }
      }
    })
  );
}
