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
  const data: { body?: string; published?: boolean } = {};
  if (typeof body.body === "string") data.body = body.body.trim();
  if (typeof body.published === "boolean") data.published = body.published;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нет данных" }, { status: 400 });
  }
  try {
    const row = await prisma.appNews.update({
      where: { id },
      data,
      select: { id: true, body: true, createdAt: true, published: true },
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
  try {
    await prisma.appNews.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
}
