import type { FnsQrParams } from "./fns-qr";

export type ReceiptLine = { name: string; sum: number; quantity?: number };

/**
 * Открытый API стороннего сервиса проверки чеков (по образцу документации proverkacheka.com):
 * POST multipart: token, qrraw — возвращает JSON с позициями чека.
 * Регистрация и токен: https://proverkacheka.com/ (лимиты по тарифу сервиса).
 */
export async function fetchReceiptLinesProverkacheka(
  qrraw: string,
  token: string
): Promise<ReceiptLine[] | null> {
  const form = new FormData();
  form.append("qrraw", qrraw.trim());
  form.append("token", token.trim());

  const res = await fetch("https://proverkacheka.com/api/v1/check/get", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(25_000),
  });

  const text = await res.text();
  if (!res.ok) return null;

  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return null;
  }

  const payload = extractProverkachekaPayload(data);
  if (payload === null) return null;

  const lines = extractLinesFromUnknownJson(payload);
  return lines.length > 0 ? lines : null;
}

/** Ответ API: `{ code: 1, data: { json: { … позиции … } } }`; при ошибке `code !== 1`. */
function extractProverkachekaPayload(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const o = data as Record<string, unknown>;
  if (typeof o.code === "number" && o.code !== 1) return null;
  const d = o.data;
  if (d && typeof d === "object") {
    const dr = d as Record<string, unknown>;
    if (dr.json != null && typeof dr.json === "object") return dr.json;
    return d;
  }
  return data;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractLinesFromUnknownJson(data: unknown): ReceiptLine[] {
  const out: ReceiptLine[] = [];
  const seen = new Set<string>();

  function visit(node: unknown, depth: number) {
    if (depth > 12 || out.length > 500) return;
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (const el of node) {
        if (el && typeof el === "object" && !Array.isArray(el)) {
          const o = el as Record<string, unknown>;
          const name =
            (typeof o.name === "string" && o.name) ||
            (typeof o.productName === "string" && o.productName) ||
            (typeof o.nm === "string" && o.nm) ||
            "";
          const sum =
            num(o.sum) ??
            num(o.total) ??
            num(o.sumWithVat) ??
            (num(o.price) != null && num(o.quantity) != null ? num(o.price)! * num(o.quantity)! : null);
          if (name && sum != null && sum > 0) {
            const key = `${name}:${sum}`;
            if (!seen.has(key)) {
              seen.add(key);
              out.push({
                name: name.slice(0, 500),
                sum: Math.round(sum * 100) / 100,
                quantity: num(o.quantity) ?? undefined,
              });
            }
          }
        }
        visit(el, depth + 1);
      }
      return;
    }

    const o = node as Record<string, unknown>;
    for (const v of Object.values(o)) visit(v, depth + 1);
  }

  visit(data, 0);
  return out;
}

/** Одна строка по сумме из QR, если внешний API недоступен. */
export function fallbackReceiptLinesFromFnsParams(parsed: FnsQrParams): ReceiptLine[] {
  if (parsed.sumRub == null || !Number.isFinite(parsed.sumRub)) return [];
  const title = ["Чек ФНС", parsed.fn && `ФН ${parsed.fn}`, parsed.i && `№${parsed.i}`]
    .filter(Boolean)
    .join(" ");
  return [{ name: title || "Чек по QR", sum: Math.round(parsed.sumRub * 100) / 100 }];
}
