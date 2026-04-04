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
  const { title, amount, category, date, note, currency, beneficiary, beneficiaryUserId, placeId } = body;

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(amount !== undefined ? { amount } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(date !== undefined ? { date: new Date(date) } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(currency !== undefined ? { currency } : {}),
      ...(beneficiary !== undefined ? { beneficiary } : {}),
      ...(beneficiaryUserId !== undefined ? { beneficiaryUserId: beneficiaryUserId || null } : {}),
      ...(placeId !== undefined ? { placeId: placeId || null } : {}),
    },
    include: { author: { select: { id: true, name: true, avatarUrl: true } }, place: true },
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
