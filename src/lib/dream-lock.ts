import { prisma } from "./prisma";

/** Если по всем строкам поддержки есть ответ — фиксируем мечту (read-only для автора). */
export async function refreshDreamLock(dreamId: string) {
  const supports = await prisma.dreamSupport.findMany({ where: { dreamId } });
  if (supports.length === 0) return;

  const allResponded = supports.every((s) => s.responseStatus !== "PENDING");
  if (allResponded) {
    await prisma.dream.update({
      where: { id: dreamId },
      data: { lockedAt: new Date() },
    });
  }
}
