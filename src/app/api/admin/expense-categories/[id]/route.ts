import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const data: { label?: string; sortOrder?: number; isActive?: boolean } = {};
  if (typeof body.label === "string") data.label = body.label.trim();
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(String(body.sortOrder), 10) || 0;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  try {
    const row = await prisma.expenseCategoryDefinition.update({
      where: { id },
      data,
    });
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }
  const { id } = await params;
  const cat = await prisma.expenseCategoryDefinition.findUnique({ where: { id } });
  if (!cat) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  const used = await prisma.expense.count({ where: { category: cat.code } });
  if (used > 0) {
    return NextResponse.json(
      { error: `Категория используется в ${used} расходах — отключите её вместо удаления` },
      { status: 409 }
    );
  }
  await prisma.expenseCategoryDefinition.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
