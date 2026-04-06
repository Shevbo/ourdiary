import type { PrismaClient } from "@prisma/client";

/** Ключ для сопоставления текста позиции чека с категорией (обучение). */
export function normalizeExpenseLineKey(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 500);
}

export async function loadSemanticHintsForLineNames(
  prisma: PrismaClient,
  titles: string[]
): Promise<Map<string, string>> {
  const keys = [...new Set(titles.map(normalizeExpenseLineKey))].filter(Boolean);
  if (keys.length === 0) return new Map();
  const rows = await prisma.expenseCategorySemanticHint.findMany({
    where: { textKey: { in: keys } },
  });
  const m = new Map<string, string>();
  for (const r of rows) {
    m.set(r.textKey, r.categoryCode);
  }
  return m;
}

export function formatHintsForPrompt(rows: { textKey: string; categoryCode: string; confirmCount: number }[]): string {
  if (rows.length === 0) return "";
  const top = [...rows].sort((a, b) => b.confirmCount - a.confirmCount).slice(0, 40);
  return top.map((r) => `- "${r.textKey}" → ${r.categoryCode}`).join("\n");
}

export async function loadTopHintsForPrompt(prisma: PrismaClient, limit = 48) {
  return prisma.expenseCategorySemanticHint.findMany({
    orderBy: { confirmCount: "desc" },
    take: limit,
  });
}
