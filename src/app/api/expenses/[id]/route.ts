import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { id } = await params;
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  if (expense.authorId !== session.user.id && !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const body = await req.json();
  const {
    title,
    amount,
    category,
    date,
    note,
    currency,
    beneficiary,
    beneficiaryUserId,
    placeId,
    imageUrl,
    receiptImageUrl,
  } = body;

  if (category !== undefined) {
    const cat = String(category).trim().toUpperCase();
    const row = await prisma.expenseCategoryDefinition.findUnique({ where: { code: cat } });
    if (!row) {
      return NextResponse.json({ error: "Неизвестная категория" }, { status: 400 });
    }
    if (!row.isActive) {
      return NextResponse.json({ error: "Категория отключена" }, { status: 400 });
    }
  }

  const patchImage = (v: unknown) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (typeof v === "string" && v.startsWith("/uploads/")) return v;
    return undefined;
  };

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(amount !== undefined ? { amount } : {}),
      ...(category !== undefined ? { category: String(category).trim().toUpperCase() } : {}),
      ...(date !== undefined ? { date: new Date(date) } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(currency !== undefined ? { currency } : {}),
      ...(beneficiary !== undefined ? { beneficiary } : {}),
      ...(beneficiaryUserId !== undefined ? { beneficiaryUserId: beneficiaryUserId || null } : {}),
      ...(placeId !== undefined ? { placeId: placeId || null } : {}),
      ...(imageUrl !== undefined ? { imageUrl: patchImage(imageUrl) } : {}),
      ...(receiptImageUrl !== undefined ? { receiptImageUrl: patchImage(receiptImageUrl) } : {}),
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      place: true,
      receiptLines: { orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { id } = await params;
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  if (expense.authorId !== session.user.id && !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
