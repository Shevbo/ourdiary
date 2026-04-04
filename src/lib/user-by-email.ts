import { prisma } from "./prisma";

/** Email в БД могли сохранить в другом регистре — ищем без учёта регистра (PostgreSQL). */
export function findUserByEmailInsensitive(email: string) {
  const e = email.trim().toLowerCase();
  return prisma.user.findFirst({
    where: { email: { equals: e, mode: "insensitive" } },
  });
}
