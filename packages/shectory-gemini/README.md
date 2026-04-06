# @shectory/gemini-proxy

Общий клиент **Gemini `generateContent`** с поддержкой **HTTP(S)-прокси** (undici) для приложений портала Shectory.

Документация для разработчиков всех проектов портала: [docs/wiki/llm-gemini-proxy.md](../../docs/wiki/llm-gemini-proxy.md).

## Сборка

```bash
npm install
npm run build
```

## Переменные окружения

См. вики: `AGENT_LLM_API_KEY`, `AGENT_PROXY` (или `AGENT_HTTPS_PROXY` / `AGENT_HTTP_PROXY`), опционально `AGENT_LLM_BASE_URL`, `AGENT_LLM_MODEL`, таймауты.
