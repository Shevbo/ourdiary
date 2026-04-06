import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ReceiptImportMeta } from "@/lib/receipt-proverkacheka";
import { classifyReceiptExpenseLines, resolvePlaceNameForExpense } from "@/lib/receipt-expense-ai";

export type ReceiptImportPersistSource = "proverkacheka" | "qr_sum" | "tabscanner_ocr";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function persistImportedReceiptExpense(
  userId: string,
  lines: { name: string; sum: number }[],
  expenseDate: Date,
  metaNote: string,
  source: ReceiptImportPersistSource,
  importMeta?: ReceiptImportMeta
) {
  const totalAmount = roundMoney(lines.reduce((s, l) => s + l.sum, 0));
  const title = `Чек · ${lines.length} поз.`.slice(0, 200);

  const categoryDefinitions = await prisma.expenseCategoryDefinition.findMany({
    where: { isActive: true },
    select: { code: true, label: true },
    orderBy: { sortOrder: "asc" },
  });
  const { parentCategory, lineCategories } = await classifyReceiptExpenseLines({
    lines,
    importMeta,
    categoryDefinitions,
  });

  const created = await prisma.$transaction(async (tx) => {
    let placeId: string | undefined;
    const placeName = resolvePlaceNameForExpense(importMeta);
    if (placeName) {
      const name = placeName.slice(0, 200);
      const existing = await tx.expensePlace.findFirst({ where: { name } });
      placeId = existing?.id ?? (await tx.expensePlace.create({ data: { name } })).id;
    }

    const noteParts: string[] = [metaNote];
    if (importMeta?.retailPlaceAddress) noteParts.push(importMeta.retailPlaceAddress);
    if (importMeta?.sellerName) noteParts.push(`Продавец: ${importMeta.sellerName}`);
    if (importMeta?.userInn) noteParts.push(`ИНН: ${importMeta.userInn}`);
    if (importMeta?.operator) noteParts.push(`Кассир: ${importMeta.operator}`);
    const firstNote = noteParts.join("\n").slice(0, 2000);

    const parent = await tx.expense.create({
      data: {
        title,
        amount: totalAmount,
        category: parentCategory,
        date: expenseDate,
        note: firstNote,
        currency: "RUB",
        authorId: userId,
        beneficiary: "FAMILY",
        placeId: placeId ?? null,
      },
    });

    const receiptLines: { id: string; title: string; amount: unknown; category: string; sortOrder: number }[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineCat = lineCategories[i] ?? "UNRECOGNIZED";
      const row = await tx.expenseReceiptLine.create({
        data: {
          expenseId: parent.id,
          title: line.name.slice(0, 200),
          amount: roundMoney(line.sum),
          category: lineCat,
          sortOrder: i,
        },
      });
      receiptLines.push({
        id: row.id,
        title: row.title,
        amount: row.amount,
        category: row.category,
        sortOrder: row.sortOrder,
      });
    }

    await tx.ratingPoint.create({
      data: {
        userId,
        points: 2,
        reason: `Импорт чека (${lines.length} поз., ${source})`,
        type: "EXPENSE_ADDED",
      },
    });

    return { parent, receiptLines };
  });

  const expenseJson = {
    id: created.parent.id,
    title: created.parent.title,
    amount: Number(created.parent.amount),
    category: created.parent.category,
    receiptLines: created.receiptLines.map((r) => ({
      id: r.id,
      title: r.title,
      amount: Number(r.amount),
      category: r.category,
      sortOrder: r.sortOrder,
    })),
  };

  return NextResponse.json({
    ok: true,
    count: 1,
    receiptLineCount: lines.length,
    source,
    expenses: [expenseJson],
  });
}
