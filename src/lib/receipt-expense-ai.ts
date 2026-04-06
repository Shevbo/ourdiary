import { geminiGenerateText, isAgentGeminiConfigured } from "@shectory/gemini-proxy";
import { prisma } from "@/lib/prisma";
import { guessExpenseCategoryFromProductName } from "@/lib/receipt-category";
import type { ReceiptImportMeta } from "@/lib/receipt-proverkacheka";
import {
  formatHintsForPrompt,
  loadSemanticHintsForLineNames,
  loadTopHintsForPrompt,
  normalizeExpenseLineKey,
} from "@/lib/expense-category-hints";

/** `\b` в JS не считает кириллицу «словом» — границы для юрформ задаём через (^|\s). */
const LEGAL_ABBREV: { re: RegExp; rep: string }[] = [
  { re: /(^|\s)(ОБЩЕСТВО\s+С\s+ОГРАНИЧЕННОЙ\s+ОТВЕТСТВЕННОСТЬЮ)/gi, rep: "$1ООО" },
  { re: /(^|\s)(ПУБЛИЧНОЕ\s+АКЦИОНЕРНОЕ\s+ОБЩЕСТВО)/gi, rep: "$1ПАО" },
  { re: /(^|\s)(ЗАКРЫТОЕ\s+АКЦИОНЕРНОЕ\s+ОБЩЕСТВО)/gi, rep: "$1ЗАО" },
  { re: /(^|\s)(НЕПУБЛИЧНОЕ\s+АКЦИОНЕРНОЕ\s+ОБЩЕСТВО)/gi, rep: "$1НАО" },
  { re: /(^|\s)(АКЦИОНЕРНОЕ\s+ОБЩЕСТВО)/gi, rep: "$1АО" },
  { re: /(^|\s)(ТОВАРИЩЕСТВО\s+С\s+ОГРАНИЧЕННОЙ\s+ОТВЕТСТВЕННОСТЬЮ)/gi, rep: "$1ТОО" },
  { re: /(^|\s)(ИНДИВИДУАЛЬНЫЙ\s+ПРЕДПРИНИМАТЕЛЬ)/gi, rep: "$1ИП" },
];

/**
 * Сокращает типовые формы юрлица в названии продавца и приводит к компактному виду для поля «Место».
 */
export function abbreviateSellerNameForPlace(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  if (!s) return "";
  s = s.replace(/\s*ИНН\s*[:\s]?\s*[\d]{10,}.*$/i, "").trim();
  s = s.replace(/ИНН\s*[:\s]?\s*[\d]+/gi, "").trim();
  for (const { re, rep } of LEGAL_ABBREV) {
    s = s.replace(re, rep);
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
  if (retail) {
    const abbr = abbreviateSellerNameForPlace(retail);
    return (abbr || retail).slice(0, 200);
  }
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
  const cutInnGlued = rest.search(/ИНН\s*[:\s]?\s*[\d]/i);
  if (cutInnGlued >= 0) rest = rest.slice(0, cutInnGlued);
  const cutCash = rest.search(/\bКассир\s*:/i);
  if (cutCash >= 0) rest = rest.slice(0, cutCash);
  let seller = rest.replace(/\s+/g, " ").trim();
  seller = seller.replace(/\s*ИНН\s*.*$/i, "").trim();
  if (!seller) return {};
  return { sellerName: seller };
}

export type CategoryDefinitionRow = { code: string; label: string };

export function dominantCategoryByAmount(categories: string[], sums: number[]): string {
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
 * Учитывает обучающий справочник `ExpenseCategorySemanticHint` (точное совпадение текста позиции).
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

  const sums = lines.map((l) => l.sum);
  const hintMap = await loadSemanticHintsForLineNames(
    prisma,
    lines.map((l) => l.name)
  );

  const mergeWithHints = (lineCategories: string[]): string[] =>
    lineCategories.map((c, i) => {
      const key = normalizeExpenseLineKey(lines[i]!.name);
      const h = hintMap.get(key);
      if (h && allowed.has(h)) return h;
      return c;
    });

  const allFromHints =
    lines.length > 0 && lines.every((l) => hintMap.has(normalizeExpenseLineKey(l.name)));
  if (allFromHints) {
    const lc = lines.map((l) => hintMap.get(normalizeExpenseLineKey(l.name))!);
    return { parentCategory: dominantCategoryByAmount(lc, sums), lineCategories: lc };
  }

  const fallback = heuristicClassify(lines);
  const fallbackMerged = mergeWithHints(fallback.lineCategories);
  const fallbackParent = dominantCategoryByAmount(fallbackMerged, sums);

  if (!isAgentGeminiConfigured() || lines.length === 0) {
    return { parentCategory: fallbackParent, lineCategories: fallbackMerged };
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

  const topHints = await loadTopHintsForPrompt(prisma);
  const hintsBlock = formatHintsForPrompt(topHints);

  const userText = `Строки чека (индекс с нуля):\n${linesBlock}\n\nКонтекст:\n${ctx.length ? ctx.join("\n") : "нет"}\n\nВерни JSON.`;

  const systemInstruction = `Ты классификатор расходов для семейного бюджета (Россия).
Для каждой строки чека выбери одну категорию из списка кодов. Коды только из списка, регистр как в списке.

Категории:
${catList}

Также выбери parentCategory — одна категория, лучше всего описывающая весь чек целиком (часто совпадает с доминирующей по сумме или смыслу).

${
  hintsBlock
    ? `Примеры, которые пользователь подтвердил ранее (ориентируйся на смысл похожих товаров):
${hintsBlock}

`
    : ""
}

Ответ строго один JSON-объект без markdown:
{"parentCategory":"КОД","lineCategories":["КОД",...]}
Длина lineCategories ровно ${lines.length} (по числу строк).`;

  try {
    const raw = await geminiGenerateText(systemInstruction, userText);
    const obj = parseJsonObject(raw);
    if (!obj) return { parentCategory: fallbackParent, lineCategories: fallbackMerged };

    const lc = obj.lineCategories;
    let lineCategories: string[] = [];
    if (Array.isArray(lc) && lc.length === lines.length) {
      lineCategories = mergeWithHints(lc.map((x) => normalizeCode(x, allowed)));
    } else {
      return { parentCategory: fallbackParent, lineCategories: fallbackMerged };
    }

    const parentCategory = dominantCategoryByAmount(lineCategories, sums);
    return { parentCategory, lineCategories };
  } catch (e) {
    console.warn("[receipt-expense-ai] Gemini classify failed:", e instanceof Error ? e.message : e);
    return { parentCategory: fallbackParent, lineCategories: fallbackMerged };
  }
}
