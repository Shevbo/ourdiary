import { geminiGenerateText, isAgentGeminiConfigured } from "@shectory/gemini-proxy";
import { guessExpenseCategoryFromProductName } from "@/lib/receipt-category";
import type { ReceiptImportMeta } from "@/lib/receipt-proverkacheka";

const LEGAL_ABBREV: { re: RegExp; short: string }[] = [
  { re: /\bОБЩЕСТВО\s+С\s+ОГРАНИЧЕННОЙ\s+ОТВЕТСТВЕННОСТЬЮ\b/gi, short: "ООО" },
  { re: /\bПУБЛИЧНОЕ\s+АКЦИОНЕРНОЕ\s+ОБЩЕСТВО\b/gi, short: "ПАО" },
  { re: /\bЗАКРЫТОЕ\s+АКЦИОНЕРНОЕ\s+ОБЩЕСТВО\b/gi, short: "ЗАО" },
  { re: /\bАКЦИОНЕРНОЕ\s+ОБЩЕСТВО\b/gi, short: "АО" },
  { re: /\bТОВАРИЩЕСТВО\s+С\s+ОГРАНИЧЕННОЙ\s+ОТВЕТСТВЕННОСТЬЮ\b/gi, short: "ТОО" },
  { re: /\bИНДИВИДУАЛЬНЫЙ\s+ПРЕДПРИНИМАТЕЛЬ\b/gi, short: "ИП" },
  { re: /\bНЕПУБЛИЧНОЕ\s+АКЦИОНЕРНОЕ\s+ОБЩЕСТВО\b/gi, short: "НАО" },
];

/**
 * Сокращает типовые формы юрлица в названии продавца и приводит к компактному виду для поля «Место».
 */
export function abbreviateSellerNameForPlace(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  if (!s) return "";
  for (const { re, short } of LEGAL_ABBREV) {
    s = s.replace(re, short);
  }
  s = s.replace(/"([^"]+)"/g, "«$1»");
  s = s.replace(/\s+/g, " ").trim();
  return s.slice(0, 200);
}

/**
 * Для карточки расхода: приоритет — продавец (сокращённо); если нет — торговая точка из чека.
 */
export function resolvePlaceNameForExpense(importMeta?: ReceiptImportMeta): string | undefined {
  const seller = importMeta?.sellerName?.trim();
  if (seller) {
    const abbr = abbreviateSellerNameForPlace(seller);
    if (abbr) return abbr;
  }
  const retail = importMeta?.placeName?.trim();
  if (retail) return retail.slice(0, 200);
  return undefined;
}

/**
 * Извлекает из текста заметки (импорт чека) поля для классификации и «Места» — продавец после `Продавец:`.
 */
export function parseReceiptMetaFromExpenseNote(note: string | null | undefined): ReceiptImportMeta {
  const t = (note ?? "").trim();
  if (!t) return {};
  const idx = t.search(/Продавец\s*:/i);
  if (idx < 0) return {};
  let rest = t.slice(idx).replace(/^Продавец\s*:\s*/i, "");
  const cutInn = rest.search(/\bИНН\s*:/i);
  if (cutInn >= 0) rest = rest.slice(0, cutInn);
  const cutCash = rest.search(/\bКассир\s*:/i);
  if (cutCash >= 0) rest = rest.slice(0, cutCash);
  const seller = rest.replace(/\s+/g, " ").trim();
  if (!seller) return {};
  return { sellerName: seller };
}

export type CategoryDefinitionRow = { code: string; label: string };

function dominantCategoryByAmount(categories: string[], sums: number[]): string {
  if (categories.length === 0 || categories.length !== sums.length) return "UNRECOGNIZED";
  const acc = new Map<string, number>();
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i] ?? "UNRECOGNIZED";
    acc.set(c, (acc.get(c) ?? 0) + (sums[i] ?? 0));
  }
  let best = "UNRECOGNIZED";
  let bestSum = -1;
  for (const [c, s] of acc) {
    if (s > bestSum) {
      bestSum = s;
      best = c;
    }
  }
  return best;
}

function heuristicClassify(
  lines: { name: string; sum: number }[]
): { parentCategory: string; lineCategories: string[] } {
  const lineCategories = lines.map((l) => guessExpenseCategoryFromProductName(l.name));
  const parentCategory = dominantCategoryByAmount(
    lineCategories,
    lines.map((l) => l.sum)
  );
  return { parentCategory, lineCategories };
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const t = text.trim();
  try {
    const j = JSON.parse(t) as unknown;
    return j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const j = JSON.parse(t.slice(start, end + 1)) as unknown;
        return j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeCode(v: unknown, allowed: Set<string>): string {
  if (typeof v !== "string") return "UNRECOGNIZED";
  const c = v.trim().toUpperCase();
  return allowed.has(c) ? c : "UNRECOGNIZED";
}

/**
 * Классификация категорий чека: Gemini при наличии AGENT_LLM_API_KEY, иначе эвристики по названиям позиций.
 */
export async function classifyReceiptExpenseLines(params: {
  lines: { name: string; sum: number }[];
  importMeta?: ReceiptImportMeta;
  categoryDefinitions: CategoryDefinitionRow[];
}): Promise<{ parentCategory: string; lineCategories: string[] }> {
  const { lines, importMeta, categoryDefinitions } = params;
  const allowed = new Set(categoryDefinitions.filter((d) => d.code).map((d) => d.code.toUpperCase()));
  if (!allowed.has("UNRECOGNIZED")) allowed.add("UNRECOGNIZED");
  if (!allowed.has("OTHER")) allowed.add("OTHER");

  const fallback = heuristicClassify(lines);

  if (!isAgentGeminiConfigured() || lines.length === 0) {
    return fallback;
  }

  const catList = categoryDefinitions
    .filter((d) => allowed.has(d.code.toUpperCase()))
    .map((d) => `- ${d.code}: ${d.label}`)
    .join("\n");

  const linesBlock = lines
    .map((l, i) => `${i}. ${l.name.replace(/\s+/g, " ").trim()} — ${l.sum} ₽`)
    .join("\n");

  const ctx: string[] = [];
  if (importMeta?.sellerName?.trim()) ctx.push(`Продавец: ${importMeta.sellerName.trim()}`);
  if (importMeta?.retailPlaceAddress?.trim()) ctx.push(`Адрес: ${importMeta.retailPlaceAddress.trim()}`);
  if (importMeta?.placeName?.trim()) ctx.push(`Торговая точка: ${importMeta.placeName.trim()}`);

  const userText = `Строки чека (индекс с нуля):\n${linesBlock}\n\nКонтекст:\n${ctx.length ? ctx.join("\n") : "нет"}\n\nВерни JSON.`;

  const systemInstruction = `Ты классификатор расходов для семейного бюджета (Россия).
Для каждой строки чека выбери одну категорию из списка кодов. Коды только из списка, регистр как в списке.

Категории:
${catList}

Также выбери parentCategory — одна категория, лучше всего описывающая весь чек целиком (часто совпадает с доминирующей по сумме или смыслу).

Ответ строго один JSON-объект без markdown:
{"parentCategory":"КОД","lineCategories":["КОД",...]}
Длина lineCategories ровно ${lines.length} (по числу строк).`;

  try {
    const raw = await geminiGenerateText(systemInstruction, userText);
    const obj = parseJsonObject(raw);
    if (!obj) return fallback;

    const parentCategory = normalizeCode(obj.parentCategory, allowed);
    const lc = obj.lineCategories;
    let lineCategories: string[] = [];
    if (Array.isArray(lc) && lc.length === lines.length) {
      lineCategories = lc.map((x) => normalizeCode(x, allowed));
    } else {
      return fallback;
    }

    return { parentCategory, lineCategories };
  } catch (e) {
    console.warn("[receipt-expense-ai] Gemini classify failed:", e instanceof Error ? e.message : e);
    return fallback;
  }
}
