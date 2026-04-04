import type { ExpenseCategory } from "@prisma/client";

const RULES: { cat: ExpenseCategory; re: RegExp[] }[] = [
  {
    cat: "FOOD",
    re: [
      /продукт|молок|хлеб|овощ|фрукт|мяс|рыб|сыр|йогурт|кафе|ресторан|пицц|суши|бургер|ашан|пятёроч|магнит|перекрёст|лента|ozon\s*fresh|вкусвилл/i,
      /еда|food|grocery/i,
    ],
  },
  {
    cat: "TRANSPORT",
    re: [
      /азс|бензин|топлив|газпром|лукойл|роснефт|shell|taxi|такси|яндекс\s*го|uber|метро|мцд|жд|билет|парков|штраф\s*гибдд/i,
    ],
  },
  {
    cat: "HEALTH",
    re: [/аптек|лекарств|клиник|стомат|врач|анализ|больниц|gemotest|инвитро/i],
  },
  {
    cat: "ENTERTAINMENT",
    re: [/кино|театр|концерт|игр|steam|подписк|netflix|okko|кинопоиск/i],
  },
  {
    cat: "EDUCATION",
    re: [/школ|курс|книг|учебник|репетитор|язык/i],
  },
  {
    cat: "CLOTHING",
    re: [/одежд|обув|hm\b|zara|uniqlo|спортмастер/i],
  },
  {
    cat: "HOME",
    re: [/ремонт|мебел|строй|leroy|ikea|обои|ламп|электрик/i],
  },
  {
    cat: "VACATION",
    re: [/отел|тур|авиа|аэрофлот|booking|санатор/i],
  },
];

export function guessExpenseCategoryFromProductName(name: string): ExpenseCategory {
  const n = name.trim();
  if (!n) return "OTHER";
  for (const { cat, re } of RULES) {
    for (const r of re) {
      if (r.test(n)) return cat;
    }
  }
  return "OTHER";
}
