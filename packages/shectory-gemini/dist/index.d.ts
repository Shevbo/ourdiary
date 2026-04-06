/**
 * Общий клиент Gemini API (`generateContent`) для экосистемы Shectory:
 * запросы к Google AI идут через HTTP(S)-прокси (undici ProxyAgent), если задан `AGENT_PROXY`.
 *
 * Переменные окружения — единые для всех прикладных проектов портала (см. docs/wiki/llm-gemini-proxy.md).
 */
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
/**
 * Читает конфигурацию из `process.env` (типичный префикс `AGENT_` для LLM в Shectory).
 */
export declare function getAgentGeminiEnv(): AgentGeminiEnv;
export declare function isAgentGeminiConfigured(): boolean;
/**
 * Один запрос `generateContent`: системная инструкция + пользовательский текст.
 */
export declare function geminiGenerateText(systemInstruction: string, userText: string, options?: GeminiGenerateTextOptions): Promise<string>;
//# sourceMappingURL=index.d.ts.map