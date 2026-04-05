import { prisma } from "./prisma";
import { createNotification } from "./create-notification";

export async function notifyAdmins(input: {
  title: string;
  body: string;
  linkUrl?: string | null;
}) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPERADMIN"] }, isServiceUser: false },
    select: { id: true },
  });
  for (const a of admins) {
    await createNotification({ userId: a.id, ...input });
  }
}
