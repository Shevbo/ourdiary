import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/create-notification";

function isSuper(role: string) {
  return role === "SUPERADMIN";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { id: dreamId } = await params;
  const dream = await prisma.dream.findUnique({ where: { id: dreamId } });
  if (!dream) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  if (dream.authorId !== session.user.id && !isSuper(session.user.role)) {
    return NextResponse.json({ error: "Только автор" }, { status: 403 });
  }
  if (dream.lockedAt) return NextResponse.json({ error: "Мечта зафиксирована" }, { status: 403 });

  const body = await req.json();
  const supporterId = String(body.supporterId ?? "");
  const requestedSembons = parseInt(String(body.requestedSembons ?? "0"), 10);
  if (!supporterId || requestedSembons < 1) {
    return NextResponse.json({ error: "supporterId и requestedSembons обязательны" }, { status: 400 });
  }
  if (supporterId === dream.authorId) {
    return NextResponse.json({ error: "Нельзя назначить автора" }, { status: 400 });
  }

  try {
    const row = await prisma.dreamSupport.create({
      data: {
        dreamId,
        supporterId,
        requestedSembons,
      },
      include: { supporter: { select: { id: true, name: true, avatarUrl: true } } },
    });
    if (dream.status === "ACTIVE") {
      const author = await prisma.user.findUnique({
        where: { id: dream.authorId },
        select: { name: true },
      });
      const authorName = author?.name ?? dream.authorId;
      await createNotification({
        userId: supporterId,
        title: "Добавлена строка поддержки",
        body: `${authorName}: «${dream.shortTitle}» — требуется согласование ${requestedSembons} семб.`,
        linkUrl: `/dreams/${dreamId}`,
      });
    }
    return NextResponse.json(row, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Уже есть поддержка от этого пользователя" }, { status: 409 });
  }
}
