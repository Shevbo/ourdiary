import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  classifyReceiptExpenseLines,
  parseReceiptMetaFromExpenseNote,
  resolvePlaceNameForExpense,
} from "@/lib/receipt-expense-ai";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

/**
 * Классификация позиций и родительской категории по ИИ + обновление «Места» из продавца в заметке.
 * Для расходов в категории UNRECOGNIZED («Не распознано»).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { id } = await params;
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { receiptLines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!expense) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  if (expense.authorId !== session.user.id && !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  if (expense.category !== "UNRECOGNIZED") {
    return NextResponse.json(
      { error: 'Доступно только для категории «Не распознано»' },
      { status: 400 }
    );
  }

  const categoryDefinitions = await prisma.expenseCategoryDefinition.findMany({
    where: { isActive: true },
    select: { code: true, label: true },
    orderBy: { sortOrder: "asc" },
  });

  const linesFromDb = expense.receiptLines.map((r) => ({
    name: r.title,
    sum: Number(r.amount),
  }));

  const lines =
    linesFromDb.length > 0
      ? linesFromDb
      : [{ name: expense.title || "Расход", sum: Number(expense.amount) }];

  const importMeta = parseReceiptMetaFromExpenseNote(expense.note);
  const { parentCategory, lineCategories } = await classifyReceiptExpenseLines({
    lines,
    importMeta,
    categoryDefinitions,
  });

  const placeName = resolvePlaceNameForExpense(importMeta);

  const updated = await prisma.$transaction(async (tx) => {
    let placeId: string | null = expense.placeId;
    if (placeName) {
      const name = placeName.slice(0, 200);
      const existing = await tx.expensePlace.findFirst({ where: { name } });
      placeId = existing?.id ?? (await tx.expensePlace.create({ data: { name } })).id;
    }

    await tx.expense.update({
      where: { id },
      data: {
        category: parentCategory,
        placeId,
      },
    });

    if (expense.receiptLines.length > 0 && lineCategories.length === expense.receiptLines.length) {
      for (let i = 0; i < expense.receiptLines.length; i++) {
        const row = expense.receiptLines[i]!;
        const cat = lineCategories[i] ?? "UNRECOGNIZED";
        await tx.expenseReceiptLine.update({
          where: { id: row.id },
          data: { category: cat },
        });
      }
    }

    return tx.expense.findUniqueOrThrow({
      where: { id },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        beneficiaryUser: { select: { id: true, name: true } },
        place: true,
        receiptLines: { orderBy: { sortOrder: "asc" } },
      },
    });
  });

  return NextResponse.json(updated);
}
