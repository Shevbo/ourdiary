import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dominantCategoryByAmount } from "@/lib/receipt-expense-ai";
import { normalizeExpenseLineKey } from "@/lib/expense-category-hints";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

async function validateCategoryCode(code: string) {
  const row = await prisma.expenseCategoryDefinition.findUnique({ where: { code } });
  if (!row) return { ok: false as const, error: "Неизвестная категория" };
  if (!row.isActive) return { ok: false as const, error: "Категория отключена" };
  return { ok: true as const };
}

type Choice = { receiptLineId: string; categoryCode: string };

/**
 * Пошаговое подтверждение категорий: сохраняет примеры в expense_category_semantic_hints и обновляет строки/родителя.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const body = (await req.json()) as {
    choices?: Choice[];
    parentCategoryOnly?: string;
  };

  const choices = Array.isArray(body.choices) ? body.choices : [];
  const parentOnly = typeof body.parentCategoryOnly === "string" ? body.parentCategoryOnly.trim().toUpperCase() : "";

  if (expense.receiptLines.length === 0) {
    if (!parentOnly) {
      return NextResponse.json({ error: "Укажите parentCategoryOnly" }, { status: 400 });
    }
    const v = await validateCategoryCode(parentOnly);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    const titleKey = normalizeExpenseLineKey(expense.title);
    if (titleKey) {
      await prisma.expenseCategorySemanticHint.upsert({
        where: { textKey: titleKey },
        create: { textKey: titleKey, categoryCode: parentOnly, confirmCount: 1 },
        update: { categoryCode: parentOnly, confirmCount: { increment: 1 } },
      });
    }
    const updated = await prisma.expense.update({
      where: { id },
      data: { category: parentOnly },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        beneficiaryUser: { select: { id: true, name: true } },
        place: true,
        receiptLines: { orderBy: { sortOrder: "asc" } },
      },
    });
    return NextResponse.json(updated);
  }

  if (choices.length === 0) {
    return NextResponse.json({ error: "Передайте choices" }, { status: 400 });
  }

  for (const ch of choices) {
    const v = await validateCategoryCode(ch.categoryCode.trim().toUpperCase());
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  }

  const lineById = new Map(expense.receiptLines.map((r) => [r.id, r]));
  for (const ch of choices) {
    const line = lineById.get(ch.receiptLineId);
    if (!line || line.expenseId !== expense.id) {
      return NextResponse.json({ error: "Неверная строка чека" }, { status: 400 });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const ch of choices) {
      const line = lineById.get(ch.receiptLineId)!;
      const cat = ch.categoryCode.trim().toUpperCase();
      const key = normalizeExpenseLineKey(line.title);
      if (key) {
        await tx.expenseCategorySemanticHint.upsert({
          where: { textKey: key },
          create: { textKey: key, categoryCode: cat, confirmCount: 1 },
          update: { categoryCode: cat, confirmCount: { increment: 1 } },
        });
      }
      await tx.expenseReceiptLine.update({
        where: { id: ch.receiptLineId },
        data: { category: cat },
      });
    }

    const lines = await tx.expenseReceiptLine.findMany({
      where: { expenseId: id },
      orderBy: { sortOrder: "asc" },
    });
    const cats = lines.map((r) => r.category);
    const sums = lines.map((r) => Number(r.amount));
    const parentCategory = dominantCategoryByAmount(cats, sums);

    await tx.expense.update({
      where: { id },
      data: { category: parentCategory },
    });

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
