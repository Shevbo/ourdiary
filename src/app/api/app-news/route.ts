import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

/** Публичная лента новостей */
export async function GET() {
  const items = await prisma.appNews.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, body: true, createdAt: true },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }
  const body = await req.json();
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Текст новости обязателен" }, { status: 400 });
  }
  const published = body.published !== false;
  const row = await prisma.appNews.create({
    data: { body: text, published },
    select: { id: true, body: true, createdAt: true, published: true },
  });
  return NextResponse.json(row, { status: 201 });
}
