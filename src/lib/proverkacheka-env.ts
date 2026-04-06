/** Токен API: основное имя и запасное (опечатки в .env / хостинге). */
export function getProverkachekaToken(): string | undefined {
  const a = process.env.PROVERKACHEKA_API_TOKEN?.trim();
  const b = process.env.PROVERKACHEKA_TOKEN?.trim();
  return a || b || undefined;
}
