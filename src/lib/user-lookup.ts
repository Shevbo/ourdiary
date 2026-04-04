import { prisma } from "./prisma";

/** Имя для входа — без учёта регистра (PostgreSQL). */
export function findUserByLoginNameInsensitive(loginName: string) {
  const n = loginName.trim().toLowerCase();
  return prisma.user.findFirst({
    where: { loginName: { equals: n, mode: "insensitive" } },
  });
}

/** Уникальный loginName на основе локальной части email. */
export async function uniqueLoginNameFromEmailLocalPart(localPart: string): Promise<string> {
  const base = localPart
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 32) || "user";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i}`;
    const taken = await prisma.user.findUnique({ where: { loginName: candidate } });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
