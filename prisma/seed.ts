import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  const superadminEmail = "bshevelev@mail.ru";
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
      email: superadminEmail,
      name: "Борис Шевелев",
      passwordHash,
      role: "SUPERADMIN",
    },
  });

  console.log(`Создан суперадмин: ${superadminEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect?.());
