/**
 * Запуск по cron в полночь (например `0 0 * * * cd /path && npx tsx scripts/midnight-worker.ts`):
 * — актуализация просроченных задач;
 * — при необходимости сюда же добавляют создание экземпляров регулярных задач и проверку уведомлений.
 */
import { prisma } from "../src/lib/prisma";
import { markOverdueTasks } from "../src/lib/mark-overdue-tasks";

async function main() {
  await markOverdueTasks();
  // Зарезервировано: создание экземпляров регулярных задач, напоминания push и т.д.
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
