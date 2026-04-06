/**
 * Общий клиент Gemini API (`generateContent`) для экосистемы Shectory:
 * запросы к Google AI идут через HTTP(S)-прокси (undici ProxyAgent), если задан `AGENT_PROXY`.
 *
 * Переменные окружения — единые для всех прикладных проектов портала (см. docs/wiki/llm-gemini-proxy.md).
 */

import { ProxyAgent, fetch as undiciFetch } from "undici";

export type AgentGeminiEnv = {
  apiKey: string | undefined;
  proxyUrl: string | undefined;
  baseUrl: string;
  model: string;
  requestTimeoutMs: number;
  proxyConnectTimeoutMs: number;
};

export type GeminiGenerateTextOptions = {
  /** Переопределить модель на один запрос (иначе из AGENT_LLM_MODEL). */
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
};

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Читает конфигурацию из `process.env` (типичный префикс `AGENT_` для LLM в Shectory).
 */
export function getAgentGeminiEnv(): AgentGeminiEnv {
  const apiKey = process.env.AGENT_LLM_API_KEY?.trim();
  const proxyUrl =
    process.env.AGENT_PROXY?.trim() ||
    process.env.AGENT_HTTPS_PROXY?.trim() ||
    process.env.AGENT_HTTP_PROXY?.trim();
  const rawBase = (process.env.AGENT_LLM_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  const baseNative =
    rawBase.replace(/\/v1beta\/openai.*$/i, "/v1beta").replace(/\/openai.*$/i, "") ||
    "https://generativelanguage.googleapis.com/v1beta";
  let model = (process.env.AGENT_LLM_MODEL ?? "gemini-2.5-flash").trim();
  model = model.replace(/^models\//, "");
  if (model === "gemini-2.0-flash") model = "gemini-2.5-flash";
  return {
    apiKey,
    proxyUrl,
    baseUrl: baseNative,
    model,
    requestTimeoutMs: envInt("AGENT_LLM_TIMEOUT_MS", 45_000),
    proxyConnectTimeoutMs: envInt("AGENT_PROXY_CONNECT_TIMEOUT_MS", 30_000),
  };
}

export function isAgentGeminiConfigured(): boolean {
  return Boolean(getAgentGeminiEnv().apiKey);
}

/**
 * Один запрос `generateContent`: системная инструкция + пользовательский текст.
 */
export async function geminiGenerateText(
  systemInstruction: string,
  userText: string,
  options?: GeminiGenerateTextOptions
): Promise<string> {
  const env = getAgentGeminiEnv();
  const { apiKey, proxyUrl, baseUrl, requestTimeoutMs, proxyConnectTimeoutMs } = env;
  if (!apiKey) throw new Error("AGENT_LLM_API_KEY is not set");

  const model = (options?.model ?? env.model).replace(/^models\//, "");
  const maxOutputTokens = options?.maxOutputTokens ?? 2048;
  const temperature = options?.temperature ?? 0.2;

  const url = `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      maxOutputTokens,
      temperature,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    };
    const fetchOptions: RequestInit & { dispatcher?: import("undici").Dispatcher } = {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal as AbortSignal,
    };
    if (proxyUrl?.trim()) {
      fetchOptions.dispatcher = new ProxyAgent({
        uri: proxyUrl.trim(),
        proxyTls: { timeout: proxyConnectTimeoutMs },
      }) as import("undici").Dispatcher;
    }
    const res = await undiciFetch(url, fetchOptions as Parameters<typeof undiciFetch>[1]);
    clearTimeout(timeout);
    const text = await res.text();
    if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 500)}`);

    const data = JSON.parse(text) as Record<string, unknown>;
    const candidates = data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
    const parts = candidates?.[0]?.content?.parts ?? [];
    const out: string[] = [];
    for (const p of parts) {
      if (p && typeof p.text === "string") out.push(p.text);
    }
    return out.join("").trim();
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}
