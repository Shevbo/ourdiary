import { prisma } from "@/lib/prisma";
import { generateUploadToken, UPLOAD_TOKEN_TTL_MS } from "@/lib/upload-token";

/**
 * Vozvrashchaet dejstvuyushchij (ne istekshij) token sobytiya ili sozdaet novyj.
 * Ispolzuetsya TV-stranicej, chtoby ne plodit tokeny na kazhdyj render.
 */
export async function getOrCreateUploadToken(eventId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const now = new Date();
  const existing = await prisma.uploadToken.findFirst({
    where: { eventId, expiresAt: { gt: now } },
    orderBy: { expiresAt: "desc" },
    select: { token: true, expiresAt: true },
  });
  if (existing) return existing;

  const token = generateUploadToken();
  const expiresAt = new Date(now.getTime() + UPLOAD_TOKEN_TTL_MS);
  const created = await prisma.uploadToken.create({
    data: { eventId, token, expiresAt },
    select: { token: true, expiresAt: true },
  });
  return created;
}
