/** Стабильный цвет для произвольного кода категории (если нет в палитре). */
export function categoryBarFillForCode(code: string, known: Record<string, string>): string {
  const k = known[code];
  if (k) return k;
  let h = 216;
  for (let i = 0; i < code.length; i++) {
    h = (h * 31 + code.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue} 52% 48%)`;
}

/** Порядок сегментов в столбике: сначала по приоритетному списку, затем остальные по алфавиту. */
export function sortCategoryCodesForStack(codes: string[], priorityOrder: string[]): string[] {
  const uniq = [...new Set(codes)].filter(Boolean);
  const pri = new Map(priorityOrder.map((c, i) => [c, i] as const));
  return uniq.sort((a, b) => {
    const aPri = pri.has(a) ? pri.get(a)! : 1_000_000;
    const bPri = pri.has(b) ? pri.get(b)! : 1_000_000;
    if (aPri !== bPri) return aPri - bPri;
    return a.localeCompare(b, "ru");
  });
}
