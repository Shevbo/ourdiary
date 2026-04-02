import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ExpensesClient from "@/components/ExpensesClient";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const expenses = await prisma.expense.findMany({
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { date: "desc" },
  });

  type ExpenseRow = typeof expenses[number];
  const serialized = expenses.map((e: ExpenseRow) => ({
    ...e,
    amount: Number(e.amount),
    date: e.date.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }));

  return <ExpensesClient expenses={serialized} />;
}
