/**
 * Импорт новости в ленту из файла (после правок в Cursor CLI / перед деплоем).
 * Запуск: npm run sync-app-news
 *
 * Читает src/content/app-news-latest.md. Если файл начинается с # SKIP — выход без изменений.
 * Если такой текст уже есть в БД — дубликат не создаётся.
 */
import "dotenv/config";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "../src/lib/prisma";

async function main() {
  const file = path.join(process.cwd(), "src", "content", "app-news-latest.md");
  let raw: string;
  try {
    raw = await readFile(file, "utf-8");
  } catch {
    console.log("sync-app-news: файл app-news-latest.md не найден — пропуск");
    return;
  }

  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("# SKIP")) {
    console.log("sync-app-news: SKIP — нечего импортировать");
    return;
  }

  const dup = await prisma.appNews.findFirst({ where: { body: trimmed } });
  if (dup) {
    console.log("sync-app-news: такой текст уже в ленте — пропуск");
    return;
  }

  await prisma.appNews.create({
    data: { body: trimmed, published: true },
  });
  console.log("sync-app-news: новость добавлена в ленту «Что нового»");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect?.());
