import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Активные категории для форм и фильтров */
export async function GET() {
  const rows = await prisma.expenseCategoryDefinition.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { code: true, label: true, sortOrder: true },
  });
  return NextResponse.json({ categories: rows });
}
