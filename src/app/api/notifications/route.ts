import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "1";
  const take = Math.min(parseInt(searchParams.get("take") ?? "50", 10) || 50, 100);

  const where = { userId: session.user.id, ...(unreadOnly ? { readAt: null } : {}) };

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.notification.count({ where: { userId: session.user.id, readAt: null } }),
  ]);

  return NextResponse.json({ items, unreadCount });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const body = await req.json();
  const markAll = body.markAll === true;
  const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];

  if (markAll) {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (ids.length > 0) {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, id: { in: ids } },
      data: { readAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
