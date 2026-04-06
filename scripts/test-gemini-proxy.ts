/**
 * Проверка вызова Gemini через AGENT_PROXY (как при разнесении по категориям).
 * Запуск: npm run test:gemini-proxy
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env"), quiet: true });
config({ path: resolve(process.cwd(), ".env.local"), override: true, quiet: true });

import { geminiGenerateText, getAgentGeminiEnv, isAgentGeminiConfigured } from "@shectory/gemini-proxy";

async function main() {
  if (!isAgentGeminiConfigured()) {
    console.error("AGENT_LLM_API_KEY не задан — проверка невозможна.");
    process.exit(1);
  }
  const env = getAgentGeminiEnv();
  const proxyHint = env.proxyUrl
    ? `да (${env.proxyUrl.replace(/:[^:@/]+@/, ":****@")})`
    : "нет (прямое соединение)";
  console.log("Прокси:", proxyHint);
  console.log("Модель:", env.model);

  const out = await geminiGenerateText(
    "Ответь ровно одним словом: OK",
    "Проверка связи через прокси Shectory."
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
