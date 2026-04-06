/**
 * Tabscanner OCR API: process → poll result.
 * @see https://docs.tabscanner.com/
 */
import type { ReceiptImportMeta } from "@/lib/receipt-proverkacheka";

const PROCESS_URL = "https://api.tabscanner.com/api/2/process";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", ".").replace(/\s/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const SUMMARY_LINE_TYPES = new Set([
  "Total",
  "SubTotal",
  "Tax",
  "TotalTax",
  "Cash",
  "Change",
  "Tip",
  "ServiceCharge",
]);

export type TabscannerProcessOk = { token: string };
export type TabscannerProcessErr = { error: string; statusCode?: number };

export async function tabscannerProcess(
  apiKey: string,
  imageBuffer: Buffer,
  mime: string,
  filename: string
): Promise<TabscannerProcessOk | TabscannerProcessErr> {
  const ext = /\.png$/i.test(filename) ? "image/png" : "image/jpeg";
  const ct = mime.includes("png") ? "image/png" : ext;
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: ct });
  const safeName = /\.(jpe?g|png)$/i.test(filename) ? filename : `${filename.replace(/\.$/, "") || "receipt"}.jpg`;
  const form = new FormData();
  form.append("file", blob, safeName);
  form.append("documentType", "receipt");
  form.append("defaultDateParsing", "d/m");

  const res = await fetch(PROCESS_URL, {
    method: "POST",
    headers: { apikey: apiKey },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { error: `Tabscanner process: ответ не JSON (HTTP ${res.status})` };
  }
  const o = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const token = typeof o.token === "string" ? o.token.trim() : "";
  if (token && (o.success === true || res.ok)) {
    return { token };
  }
  const msg =
    (typeof o.message === "string" && o.message) ||
    (typeof o.error === "string" && o.error) ||
    `Tabscanner process: HTTP ${res.status}`;
  const statusCode = typeof o.status_code === "number" ? o.status_code : res.status;
  return { error: msg, statusCode };
}

export async function tabscannerFetchResult(apiKey: string, token: string): Promise<unknown> {
  const url = `https://api.tabscanner.com/api/result/${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { apikey: apiKey },
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Tabscanner result: не JSON (HTTP ${res.status})`);
  }
}

/** Короткий polling: рекомендация Tabscanner — подождать ~5 с, затем опрос раз в 1 с. */
export async function tabscannerPollUntilDone(apiKey: string, token: string): Promise<Record<string, unknown>> {
  await sleep(4000);
  const maxAttempts = 50;
  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) await sleep(1000);
    const data = await tabscannerFetchResult(apiKey, token);
    if (!data || typeof data !== "object") continue;
    const o = data as Record<string, unknown>;
    const status = typeof o.status === "string" ? o.status.toLowerCase() : "";
    if (status === "failed" || o.success === false) {
      const msg =
        (typeof o.message === "string" && o.message) ||
        (typeof o.error === "string" && o.error) ||
        "Tabscanner: распознавание не удалось";
      throw new Error(msg);
    }
    if (status === "done" && o.result && typeof o.result === "object") {
      return o;
    }
    const code = typeof o.code === "number" ? o.code : typeof o.status_code === "number" ? o.status_code : null;
    if (code === 301 || status === "pending") continue;
    if (o.result && typeof o.result === "object") return o;
  }
  throw new Error("Tabscanner: превышено время ожидания результата OCR");
}

function innerResult(root: Record<string, unknown>): Record<string, unknown> | null {
  const r = root.result;
  if (r && typeof r === "object" && !Array.isArray(r)) return r as Record<string, unknown>;
  return null;
}

export function tabscannerLinesFromResult(root: Record<string, unknown>): { name: string; sum: number }[] {
  const inner = innerResult(root);
  if (!inner) return [];
  const items = inner.lineItems;
  if (!Array.isArray(items)) return [];
  const out: { name: string; sum: number }[] = [];
  for (const el of items) {
    if (!el || typeof el !== "object" || Array.isArray(el)) continue;
    const row = el as Record<string, unknown>;
    const lt = typeof row.lineType === "string" ? row.lineType.trim() : "";
    if (SUMMARY_LINE_TYPES.has(lt)) continue;
    const lineTotal = num(row.lineTotal);
    const price = num(row.price);
    const qtyRaw = num(row.qty);
    const qty = qtyRaw != null && qtyRaw > 0 ? qtyRaw : 1;
    let sum = lineTotal;
    if (sum == null || sum <= 0) {
      if (price != null && price > 0) sum = round2(price * qty);
    }
    if (sum == null || sum <= 0) continue;
    const name = (
      (typeof row.descClean === "string" && row.descClean.trim()) ||
      (typeof row.desc === "string" && row.desc.trim()) ||
      "Позиция"
    ).slice(0, 500);
    out.push({ name, sum: round2(sum) });
  }
  if (out.length > 0) return out;

  const total = num(inner.total);
  if (total != null && total > 0) {
    const est =
      (typeof inner.establishment === "string" && inner.establishment.trim()) ||
      (typeof inner.merchant === "string" && inner.merchant.trim()) ||
      "";
    const title = est ? `${est.slice(0, 120)} · чек` : "Чек (OCR)";
    return [{ name: title.slice(0, 200), sum: round2(total) }];
  }
  return [];
}

export function tabscannerExpenseDate(inner: Record<string, unknown>): Date | null {
  const iso = typeof inner.dateISO === "string" ? inner.dateISO.trim() : "";
  const d = typeof inner.date === "string" ? inner.date.trim() : "";
  const raw = iso || d;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function tabscannerImportMeta(inner: Record<string, unknown>): ReceiptImportMeta {
  const trim = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);
  const establishment = trim(inner.establishment);
  return {
    placeName: establishment,
    sellerName: establishment,
    retailPlaceAddress: trim(inner.address),
    operator: undefined,
    userInn: undefined,
  };
}

export function tabscannerBuildImport(root: Record<string, unknown>): {
  lines: { name: string; sum: number }[];
  expenseDate: Date;
  importMeta: ReceiptImportMeta;
} {
  const inner = innerResult(root) ?? {};
  const lines = tabscannerLinesFromResult(root);
  const expenseDate = tabscannerExpenseDate(inner) ?? new Date();
  const importMeta = tabscannerImportMeta(inner);
  return { lines, expenseDate, importMeta };
}
