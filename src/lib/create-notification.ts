import { prisma } from "./prisma";
import { notifyUserIds } from "./notify-users";

export async function createNotification(input: {
  userId: string;
  title: string;
  body: string;
  linkUrl?: string | null;
}) {
  const n = await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl ?? undefined,
    },
  });

  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
  const url = input.linkUrl ? (base ? `${base}${input.linkUrl}` : input.linkUrl) : undefined;
  void notifyUserIds([input.userId], {
    title: input.title,
    body: input.body,
    ...(url ? { url } : {}),
  });

  return n;
}
