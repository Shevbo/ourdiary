import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const category = searchParams.get("category");
  const userId = searchParams.get("userId");

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (userId) where.authorId = userId;
  if (from || to) {
    where.date = {};
    if (from) (where.date as Record<string, unknown>).gte = new Date(from);
    if (to) (where.date as Record<string, unknown>).lte = new Date(to);
  }

  const [expenses, byCategory] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.expense.groupBy({
      by: ["category"],
      where,
      _sum: { amount: true },
    }),
  ]);

  const total = expenses.reduce((sum: number, e: { amount: unknown }) => sum + Number(e.amount), 0);

  const aggregates = byCategory.map((row) => ({
    category: row.category,
    sum: Number(row._sum.amount ?? 0),
  }));

  return NextResponse.json({ expenses, total, byCategory: aggregates });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const body = await req.json();
  const { title, amount, category, date, note, currency } = body;

  if (!title || !amount) {
    return NextResponse.json({ error: "title и amount обязательны" }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      title,
      amount,
      category: category ?? "OTHER",
      date: date ? new Date(date) : new Date(),
      note,
      currency: currency ?? "RUB",
      authorId: session.user.id,
    },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });

  await prisma.ratingPoint.create({
    data: {
      userId: session.user.id,
      points: 2,
      reason: `Добавлен расход: ${title}`,
      type: "EXPENSE_ADDED",
    },
  });

  return NextResponse.json(expense, { status: 201 });
}
