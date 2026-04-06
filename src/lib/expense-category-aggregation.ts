/**
 * Распределение суммы расхода по категориям для отчётов:
 * при наличии строк чека — по категориям строк; иначе вся сумма в категории родителя.
 * Разница между суммой родителя и суммой строк (округление и т.п.) относится к категории родителя.
 */
export type ExpenseLikeForBuckets = {
  amount: number;
  category: string;
  receiptLines: { amount: number; category: string }[];
};

export function addExpenseToCategoryBuckets(
  buckets: Record<string, number | undefined>,
  expense: ExpenseLikeForBuckets
): void {
  const lines = expense.receiptLines;
  if (lines.length > 0) {
    let sumLines = 0;
    for (const line of lines) {
      const a = Number(line.amount);
      sumLines += a;
      const code = String(line.category).trim().toUpperCase() || expense.category;
      buckets[code] = (buckets[code] ?? 0) + a;
    }
    const diff = Number(expense.amount) - sumLines;
    if (Math.abs(diff) > 0.01) {
      const parent = String(expense.category).trim().toUpperCase() || "OTHER";
      buckets[parent] = (buckets[parent] ?? 0) + diff;
    }
  } else {
    const cat = String(expense.category).trim().toUpperCase() || "OTHER";
    buckets[cat] = (buckets[cat] ?? 0) + Number(expense.amount);
  }
}
