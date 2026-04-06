/**
 * Проверка вызова Gemini через AGENT_PROXY (как при разнесении по категориям).
 * Запуск: npm run test:gemini-proxy
 *
 * Сначала подгружаются .env — только потом клиент Gemini.
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env"), quiet: true });
config({ path: resolve(process.cwd(), ".env.local"), override: true, quiet: true });

async function main() {
  const { geminiGenerateText, getAgentGeminiEnv, isAgentGeminiConfigured } = await import("@shectory/gemini-proxy");

  if (!isAgentGeminiConfigured()) {
    console.error("AGENT_LLM_API_KEY не задан — проверка невозможна.");
    process.exit(1);
  }
  const env = getAgentGeminiEnv();
  const proxyHint = env.proxyUrl
    ? `да (${env.proxyUrl.replace(/:[^:@/]+@/, ":****@")})`
    : "нет (прямое соединение — для регионов с ограничением Google добавьте AGENT_PROXY в .env)";
  console.log("Прокси:", proxyHint);
  console.log("Модель по умолчанию (AGENT_LLM_MODEL):", env.model);
  if (!env.proxyUrl?.trim()) {
    console.warn(
      "Внимание: без AGENT_PROXY запрос может завершиться ошибкой региона (FAILED_PRECONDITION / User location is not supported)."
    );
  }

  /** Тяжёлые preview-модели могут не уложиться в таймаут; smoke проверяет канал и прокси через быстрый вызов. */
  const smokeModel = "gemini-2.5-flash";
  console.log("Smoke-запрос:", smokeModel);

  const out = await geminiGenerateText(
    "Ответь ровно одним словом: OK",
    "Проверка связи через прокси Shectory.",
    { model: smokeModel, maxOutputTokens: 64 }
  );
  const trimmed = out.trim();
  console.log("Ответ модели:", trimmed.slice(0, 120));
  if (!/OK/i.test(trimmed)) {
    console.error("Неожиданный ответ (ожидалось OK).");
    process.exit(1);
  }
  console.log("Успех: запрос к внешней модели выполнен без ошибок.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
