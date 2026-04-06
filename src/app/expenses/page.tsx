import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ExpensesClient from "@/components/ExpensesClient";
import { subMonths, startOfMonth, format } from "date-fns";
import { ru } from "date-fns/locale";
import { addExpenseToCategoryBuckets } from "@/lib/expense-category-aggregation";
export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const chartFrom = startOfMonth(subMonths(new Date(), 11));

  const [expenses, forChart] = await Promise.all([
    prisma.expense.findMany({
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        beneficiaryUser: { select: { id: true, name: true } },
        place: true,
        receiptLines: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.expense.findMany({
      where: { date: { gte: chartFrom } },
      select: {
        date: true,
        amount: true,
        category: true,
        receiptLines: { select: { amount: true, category: true } },
      },
    }),
  ]);

  type ExpenseRow = typeof expenses[number];
  const serialized = expenses.map((e: ExpenseRow) => ({
    ...e,
    amount: Number(e.amount),
    date: e.date.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    receiptLines: e.receiptLines.map((r) => ({
      id: r.id,
      title: r.title,
      amount: Number(r.amount),
      category: r.category,
      sortOrder: r.sortOrder,
    })),
  }));

  const bucket: Record<string, number> = {};
  const bucketByCat: Record<string, Partial<Record<string, number>>> = {};
  for (const row of forChart) {
    const k = format(row.date, "yyyy-MM");
    bucket[k] = (bucket[k] ?? 0) + Number(row.amount);
    if (!bucketByCat[k]) bucketByCat[k] = {};
    const byMonth = bucketByCat[k]!;
    addExpenseToCategoryBuckets(byMonth, {
      amount: Number(row.amount),
      category: row.category,
      receiptLines: row.receiptLines.map((r) => ({
        amount: Number(r.amount),
        category: r.category,
      })),
    });
  }

  const monthlyTotals: {
    label: string;
    total: number;
    byCategory: Partial<Record<string, number>>;
  }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = startOfMonth(subMonths(new Date(), i));
    const k = format(d, "yyyy-MM");
    monthlyTotals.push({
      label: format(d, "LLL", { locale: ru }),
      total: bucket[k] ?? 0,
      byCategory: bucketByCat[k] ?? {},
    });
  }

  return (
    <ExpensesClient
      expenses={serialized}
      monthlyTotals={monthlyTotals}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
    />
  );
}
