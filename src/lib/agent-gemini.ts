/**
 * Вызов Gemini (generateContent) с поддержкой HTTP-прокси, как в komissionka:
 * AGENT_LLM_API_KEY, AGENT_PROXY (или AGENT_HTTPS_PROXY / AGENT_HTTP_PROXY),
 * опционально AGENT_LLM_BASE_URL, AGENT_LLM_MODEL, AGENT_PROXY_CONNECT_TIMEOUT_MS.
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

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

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
 * Один запрос generateContent: системная инструкция + пользовательский текст.
 */
export async function geminiGenerateText(systemInstruction: string, userText: string): Promise<string> {
  const { apiKey, proxyUrl, baseUrl, model, requestTimeoutMs, proxyConnectTimeoutMs } = getAgentGeminiEnv();
  if (!apiKey) throw new Error("AGENT_LLM_API_KEY is not set");

  const url = `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.2,
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
      signal: controller.signal as any,
    };
    if (proxyUrl?.trim()) {
      fetchOptions.dispatcher = new ProxyAgent({
        uri: proxyUrl.trim(),
        proxyTls: { timeout: proxyConnectTimeoutMs },
      }) as import("undici").Dispatcher;
    }
    const res = await undiciFetch(url, fetchOptions as any);
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
