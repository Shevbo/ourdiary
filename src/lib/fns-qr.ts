/**
 * Разбор строки QR фискального чека РФ (ФНС / ОФД).
 * Типичный формат: t=YYYYMMDDTHHmm&s=123.45&fn=...&i=...&fp=...&n=1
 * или полный URL с теми же query-параметрами.
 */
export type FnsQrParams = {
  /** Дата/время операции YYYYMMDDTHHmm */
  t?: string;
  /** Сумма чека (руб.) */
  sumRub?: number;
  fn?: string;
  /** ФД (номер фискального документа) */
  i?: string;
  /** ФП / ФПД */
  fp?: string;
  n?: string;
  /** Исходная строка для внешних API */
  raw: string;
};

function parseSum(s: string | null): number | undefined {
  if (!s) return undefined;
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Приводит распознанный текст к одной строке `qrraw` для ProverkaCheka / ФНС
 * (порядок полей и значения как в QR).
 */
export function canonicalFnsQrraw(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let query = raw;
  try {
    const u = new URL(raw);
    query = u.search ? u.search.slice(1) : raw;
  } catch {
    const q = raw.indexOf("?");
    if (q >= 0) query = raw.slice(q + 1);
  }

  const sp = new URLSearchParams(query);
  const t = sp.get("t");
  const s = sp.get("s");
  const fn = sp.get("fn");
  const i = sp.get("i");
  const fp = sp.get("fp");
  const n = sp.get("n");
  if (!t || !s || !fn || !i || !fp || n === null) return null;
  return `t=${t}&s=${s}&fn=${fn}&i=${i}&fp=${fp}&n=${n}`;
}

export function parseFnsQrRaw(input: string): FnsQrParams | null {
  const raw = input.trim();
  if (!raw) return null;

  let query = raw;
  try {
    const u = new URL(raw);
    query = u.search || raw;
  } catch {
    const q = raw.indexOf("?");
    if (q >= 0) query = raw.slice(q);
  }

  const sp = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  const t = sp.get("t") ?? undefined;
  const sumRub = parseSum(sp.get("s"));
  return {
    raw,
    t,
    sumRub,
    fn: sp.get("fn") ?? undefined,
    i: sp.get("i") ?? undefined,
    fp: sp.get("fp") ?? undefined,
    n: sp.get("n") ?? undefined,
  };
}

/** Дата из параметра t (локальная). */
export function dateFromFnsT(t?: string): Date | null {
  if (!t || t.length < 8) return null;
  const y = parseInt(t.slice(0, 4), 10);
  const mo = parseInt(t.slice(4, 6), 10) - 1;
  const d = parseInt(t.slice(6, 8), 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const out = new Date(y, mo, d);
  if (t.includes("T") && t.length >= 13) {
    const hh = parseInt(t.slice(9, 11), 10);
    const mm = parseInt(t.slice(11, 13), 10);
    if (Number.isFinite(hh)) out.setHours(hh, Number.isFinite(mm) ? mm : 0, 0, 0);
  }
  return out;
}
