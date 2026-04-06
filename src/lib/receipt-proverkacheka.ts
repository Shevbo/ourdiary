import { parseFnsQrRaw, type FnsQrParams } from "./fns-qr";

export type ReceiptLine = { name: string; sum: number; quantity?: number };

export type ProverkachekaInput =
  | { qrraw: string }
  | { file: Buffer; filename: string; mime: string };

export type ProverkachekaResult =
  | { ok: true; lines: ReceiptLine[]; parsedQr: FnsQrParams; rawJson: unknown }
  | { ok: false; error: string; code?: number };

/**
 * API proverkacheka.com: POST multipart `token` + `qrraw` или `qrfile` (фото чека с QR).
 * Спецификация: `documentation_api.pdf` в корне репозитория — `data.json.items[].sum`, `totalSum` в **копейках**.
 */
export async function callProverkachekaCheck(
  token: string,
  input: ProverkachekaInput
): Promise<ProverkachekaResult> {
  const form = new FormData();
  form.append("token", token.trim());
  if ("qrraw" in input) {
    form.append("qrraw", input.qrraw.trim());
  } else {
    const blob = new Blob([new Uint8Array(input.file)], { type: input.mime || "image/jpeg" });
    const rawName = input.filename?.trim() || "receipt.jpg";
    const fileName = /\.(jpe?g|png|webp|heic|gif)$/i.test(rawName) ? rawName : `${rawName.replace(/\.$/, "") || "receipt"}.jpg`;
    form.append("qrfile", blob, fileName);
  }

  const res = await fetch("https://proverkacheka.com/api/v1/check/get", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(25_000),
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    const snippet = text.replace(/\s+/g, " ").slice(0, 160);
    return {
      ok: false,
      error: res.ok
        ? `Некорректный ответ API (не JSON)${snippet ? `: ${snippet}` : ""}`
        : `Сервис проверки чека недоступен (HTTP ${res.status})`,
    };
  }

  if (!data || typeof data !== "object") {
    return { ok: false, error: "Пустой ответ API" };
  }
  const root = data as Record<string, unknown>;
  const apiCode = normalizeProverkachekaCode(root.code);
  if (apiCode !== null && apiCode !== 1) {
    const msg = extractProverkachekaErrorMessage(root, apiCode);
    return { ok: false, error: msg, code: apiCode };
  }

  const payload = extractProverkachekaPayload(data);
  let lines = extractStructuredReceiptLines(payload ?? data);
  if (lines.length === 0) {
    lines = extractLinesFromUnknownJson(payload ?? data);
  }
  if (lines.length === 0) {
    lines = extractSingleLineFromReceiptTotals(payload ?? data);
  }
  if (lines.length === 0) {
    return {
      ok: false,
      error:
        "В ответе ФНС нет ни позиций, ни итога. Сфотографируйте чек целиком (список покупок + QR) или проверьте чек в сервисе.",
    };
  }

  const fallbackQr = "qrraw" in input ? input.qrraw.trim() : undefined;
  const parsedQr = buildParsedFromProverkachekaResponse(lines, data, fallbackQr);
  return { ok: true, lines, parsedQr, rawJson: data };
}

/** API иногда отдаёт code строкой (`"1"`, `"2"`). */
function normalizeProverkachekaCode(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseInt(v.trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractProverkachekaErrorMessage(root: Record<string, unknown>, code: number): string {
  const fromData = root.data;
  let dataStr = "";
  if (typeof fromData === "string") dataStr = fromData;
  else if (fromData && typeof fromData === "object" && !Array.isArray(fromData)) {
    const d = fromData as Record<string, unknown>;
    dataStr =
      (typeof d.message === "string" && d.message) ||
      (typeof d.error === "string" && d.error) ||
      (typeof d.text === "string" && d.text) ||
      "";
  }
  return (
    (typeof root.message === "string" && root.message) ||
    dataStr ||
    (typeof root.description === "string" && root.description) ||
    `Ошибка проверки чека (код ${code})`
  );
}

/** Совместимость: только строка QR, без фото. */
export async function fetchReceiptLinesProverkacheka(
  qrraw: string,
  token: string
): Promise<ReceiptLine[] | null> {
  const r = await callProverkachekaCheck(token, { qrraw });
  if (!r.ok) return null;
  return r.lines;
}

function buildParsedFromProverkachekaResponse(
  lines: ReceiptLine[],
  rawJson: unknown,
  fallbackQrRaw?: string
): FnsQrParams {
  const qrRaw = extractQrRawStringFromJson(rawJson) ?? fallbackQrRaw ?? "";
  if (qrRaw) {
    const p = parseFnsQrRaw(qrRaw);
    if (p) return p;
  }
  const total = lines.reduce((s, l) => s + l.sum, 0);
  return {
    raw: qrRaw || "proverkacheka",
    t: extractDateTFromJson(rawJson),
    sumRub: total,
    fn: extractFieldByKey(rawJson, "fn") ?? extractFieldByKey(rawJson, "fiscalDriveNumber"),
    i:
      extractFieldByKey(rawJson, "i") ??
      extractFieldByKey(rawJson, "fd") ??
      extractFieldByKey(rawJson, "fiscalDocumentNumber"),
  };
}

function extractQrRawStringFromJson(data: unknown): string | null {
  const visit = (node: unknown): string | null => {
    if (typeof node === "string") {
      const s = node.trim();
      if (s.includes("fn=") && (s.includes("t=") || s.includes("fp=") || s.includes("s="))) return s;
      if (s.startsWith("http") && s.includes("fn=")) return s;
      return null;
    }
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const el of node) {
        const r = visit(el);
        if (r) return r;
      }
      return null;
    }
    for (const v of Object.values(node)) {
      const r = visit(v);
      if (r) return r;
    }
    return null;
  };
  return visit(data);
}

function extractFieldByKey(data: unknown, key: string): string | undefined {
  const visit = (node: unknown): string | undefined => {
    if (!node || typeof node !== "object") return undefined;
    if (Array.isArray(node)) {
      for (const el of node) {
        const r = visit(el);
        if (r) return r;
      }
      return undefined;
    }
    const o = node as Record<string, unknown>;
    if (key in o) {
      const v = o[key];
      if (typeof v === "string" && v) return v;
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
    for (const v of Object.values(o)) {
      const r = visit(v);
      if (r) return r;
    }
    return undefined;
  };
  return visit(data);
}

/** Параметр t для dateFromFnsT: YYYYMMDDTHHmm из unix / dateTime в JSON. */
function extractDateTFromJson(data: unknown): string | undefined {
  const visit = (node: unknown): number | null => {
    if (typeof node === "number" && node > 1_540_000_000 && node < 2_000_000_000) return Math.floor(node);
    if (typeof node === "number" && node > 1_540_000_000_000 && node < 2_000_000_000_000)
      return Math.floor(node / 1000);
    if (!node || typeof node !== "object") return null;
    const o = node as Record<string, unknown>;
    if ("dateTime" in o) {
      const n =
        typeof o.dateTime === "number"
          ? o.dateTime
          : typeof o.dateTime === "string"
            ? parseFloat(o.dateTime)
            : NaN;
      if (Number.isFinite(n)) {
        if (n > 1e12) return Math.floor(n / 1000);
        if (n > 1e9) return Math.floor(n);
      }
    }
    if (Array.isArray(node)) {
      for (const el of node) {
        const r = visit(el);
        if (r) return r;
      }
      return null;
    }
    for (const v of Object.values(o)) {
      const r = visit(v);
      if (r) return r;
    }
    return null;
  };
  const unix = visit(data);
  if (!unix) return undefined;
  const d = new Date(unix * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** Ответ API: `{ code: 1, data: { json: { … } } }`. */
function extractProverkachekaPayload(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const o = data as Record<string, unknown>;
  const c = normalizeProverkachekaCode(o.code);
  if (c !== null && c !== 1) return null;
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

/** Спецификация API: data.json.items[].sum — в копейках. */
function kopecksToRub(kop: number): number {
  return Math.round((kop / 100) * 100) / 100;
}

/**
 * Прямой разбор `data.json.items` по спецификации ProverkaCheka (name, quantity, sum в коп.).
 */
function extractStructuredReceiptLines(payload: unknown): ReceiptLine[] {
  if (!payload || typeof payload !== "object") return [];
  const o = payload as Record<string, unknown>;
  const items = o.items;
  if (!Array.isArray(items) || items.length === 0) return [];
  const out: ReceiptLine[] = [];
  for (const el of items) {
    if (!el || typeof el !== "object" || Array.isArray(el)) continue;
    const row = el as Record<string, unknown>;
    const name =
      (typeof row.name === "string" && row.name.trim()) ||
      (typeof row.nomenclature === "string" && row.nomenclature.trim()) ||
      "";
    if (!name) continue;
    const sumRaw = num(row.sum);
    if (sumRaw == null || sumRaw <= 0) continue;
    const sumRub = Number.isInteger(sumRaw) ? kopecksToRub(sumRaw) : Math.round(sumRaw * 100) / 100;
    out.push({
      name: name.slice(0, 500),
      sum: sumRub,
      quantity: num(row.quantity) ?? undefined,
    });
  }
  return out;
}

/**
 * Если позиций нет (обрезанное фото и т.п.), но есть totalSum в коп. и реквизиты магазина.
 */
function extractSingleLineFromReceiptTotals(payload: unknown): ReceiptLine[] {
  const j =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  if (!j) return [];
  const totalRaw = num(j.totalSum);
  if (totalRaw == null || totalRaw <= 0) return [];
  const sumRub = Number.isInteger(totalRaw) ? kopecksToRub(totalRaw) : Math.round(totalRaw * 100) / 100;
  const user = typeof j.user === "string" ? j.user.trim() : "";
  const addr =
    (typeof j.retailPlaceAddress === "string" && j.retailPlaceAddress.trim()) ||
    (typeof j.retailPlaceAddres === "string" && j.retailPlaceAddres.trim()) ||
    "";
  const title = [user || null, addr || null].filter(Boolean).join(" · ").slice(0, 300);
  const name = title || "Покупки по чеку (позиции не пришли в ответе ФНС)";
  return [{ name, sum: sumRub }];
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

/** HTTP-статус для ответа клиенту при ошибке API (лимит бесплатного тарифа и т.п.). */
export function httpStatusForProverkachekaError(error: string, code?: number): number {
  if (code === 429) return 429;
  if (/лимит|исчерпан|превыш|limit|exceeded|429/i.test(error)) return 429;
  if (code === 2 || code === 3 || code === 4) return 429;
  return 422;
}
