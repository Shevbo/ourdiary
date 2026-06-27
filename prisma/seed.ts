import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

async function ensureSuperadmin() {
  const superadminEmail = "bshevelev@mail.ru";
  const loginName = "bshevelev";
  const password = process.env.SEED_SUPERADMIN_PASSWORD ?? "changeme-dev-only";

  const existing = await prisma.user.findUnique({ where: { email: superadminEmail } });

  if (existing) {
    if (existing.role !== "SUPERADMIN") {
      await prisma.user.update({
        where: { email: superadminEmail },
        data: { role: "SUPERADMIN" },
      });
      console.log(`Роль пользователя ${superadminEmail} обновлена до SUPERADMIN`);
    } else {
      console.log(`Пользователь ${superadminEmail} уже существует с ролью SUPERADMIN`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      loginName,
      email: superadminEmail,
      name: "Борис Шевелев",
      passwordHash,
      role: "SUPERADMIN",
    },
  });

  console.log(`Создан суперадмин: ${loginName} / ${superadminEmail}`);
}


async function main() {
  await ensureSuperadmin();

  // ─── Сервис-пользователь «Дом Бориса» (authorId сервис-эндпоинтов) ──────────
  await prisma.user.upsert({
    where: { loginName: "dom-borisa" },
    update: { isServiceUser: true, name: "Дом Бориса" },
    create: {
      loginName: "dom-borisa",
      email: "dom-borisa@local",
      name: "Дом Бориса",
      isServiceUser: true,
      role: "MEMBER",
    },
  });
  console.log("Сервис-пользователь dom-borisa готов");

  // ─── Категории ТВ-календаря (idempotent upsert by name) ─────────────────────
  const categories: { name: string; color: string; order: number }[] = [
    { name: "Семья", color: "#22c55e", order: 1 },
    { name: "Дети", color: "#f97316", order: 2 },
    { name: "Школа", color: "#3b82f6", order: 3 },
    { name: "Работа", color: "#6366f1", order: 4 },
    { name: "Здоровье", color: "#ef4444", order: 5 },
    { name: "Праздники", color: "#a855f7", order: 6 },
    { name: "Дом", color: "#14b8a6", order: 7 },
    { name: "Личное", color: "#eab308", order: 8 },
  ];
  for (const c of categories) {
    await prisma.category.upsert({
      where: { name: c.name },
      update: { color: c.color, order: c.order },
      create: { name: c.name, color: c.color, order: c.order },
    });
  }
  console.log(`Категории ТВ-календаря готовы: ${categories.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect?.());
