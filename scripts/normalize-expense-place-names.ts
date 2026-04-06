/**
 * Одноразово приводит названия «Место» к сокращённому виду (ООО, ИП и т.д.).
 * При совпадении имён после нормализации объединяет записи расходов в одно место.
 *
 * Запуск: npm run normalize-expense-places
 * Требуется DATABASE_URL в .env / .env.local.
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env"), quiet: true });
config({ path: resolve(process.cwd(), ".env.local"), override: true, quiet: true });

import { prisma } from "../src/lib/prisma";
import { abbreviateSellerNameForPlace } from "../src/lib/receipt-expense-ai";

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("normalize-expense-places: задайте DATABASE_URL в .env или .env.local.");
    process.exit(1);
  }

  const places = await prisma.expensePlace.findMany({ orderBy: { id: "asc" } });
  let renamed = 0;
  let merged = 0;

  for (const place of places) {
    const row = await prisma.expensePlace.findUnique({ where: { id: place.id } });
    if (!row) continue;

    const newName = abbreviateSellerNameForPlace(row.name) || row.name;
    if (newName === row.name) continue;

    const existing = await prisma.expensePlace.findFirst({
      where: { name: newName },
    });

    if (existing && existing.id !== row.id) {
      await prisma.expense.updateMany({
        where: { placeId: row.id },
        data: { placeId: existing.id },
      });
      await prisma.expensePlace.delete({ where: { id: row.id } });
      merged += 1;
      console.log(`merge "${row.name}" → "${newName}" (→ ${existing.id})`);
    } else if (!existing) {
      await prisma.expensePlace.update({
        where: { id: row.id },
        data: { name: newName },
      });
      renamed += 1;
      console.log(`rename "${row.name}" → "${newName}"`);
    }
  }

  console.log(`Готово: переименовано ${renamed}, слияний ${merged}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
