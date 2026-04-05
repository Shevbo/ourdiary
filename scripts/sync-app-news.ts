/**
 * Импорт новости в ленту из файла (после правок в Cursor CLI / перед деплоем).
 * Запуск: npm run sync-app-news
 *
 * Читает src/content/app-news-latest.md. Если файл начинается с # SKIP — выход без изменений.
 * Если такой текст уже есть в БД — дубликат не создаётся.
 *
 * Сначала подгружаются .env и .env.local — только потом Prisma (иначе DATABASE_URL пустой).
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFile } from "fs/promises";
import path from "path";

config({ path: resolve(process.cwd(), ".env"), quiet: true });
config({ path: resolve(process.cwd(), ".env.local"), override: true, quiet: true });

function parseDbHost(url: string): string | null {
  try {
    const u = new URL(url.replace(/^postgresql:/i, "http:"));
    return u.hostname || null;
  } catch {
    return null;
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.error(
      "sync-app-news: не задан DATABASE_URL. Укажите его в .env или .env.local (как у next dev)."
    );
    process.exit(1);
  }

  const host = parseDbHost(dbUrl);
  if (host && (host === "HOST" || host === "host")) {
    console.error(
      "sync-app-news: в DATABASE_URL подставлен шаблон HOST из .env.example — замените на реальный хост (например 127.0.0.1 для локального PostgreSQL)."
    );
    process.exit(1);
  }

  const { prisma } = await import("../src/lib/prisma");

  try {
    await prisma.$connect();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/EAI_AGAIN|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(msg)) {
      console.error(
        "sync-app-news: не удаётся подключиться к PostgreSQL. Проверьте DATABASE_URL, что сервер БД запущен и с хоста «" +
          (host ?? "?") +
          "» есть соединение (для разработки на ПК часто нужен 127.0.0.1 и локальный postgres)."
      );
      process.exit(1);
    }
    throw e;
  }

  try {
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
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
