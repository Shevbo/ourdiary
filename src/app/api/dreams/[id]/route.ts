import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/create-notification";
import { refreshDreamLock } from "@/lib/dream-lock";

function isSuper(role: string) {
  return role === "SUPERADMIN";
}

async function loadVisible(id: string, userId: string, role: string) {
  const dream = await prisma.dream.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      supports: {
        include: { supporter: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });
  if (!dream) return { dream: null as typeof dream, visible: false };
  if (isSuper(role)) return { dream, visible: true };
  if (dream.authorId === userId) return { dream, visible: true };
  const isSupporter = dream.supports.some((s) => s.supporterId === userId);
  return { dream, visible: isSupporter };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { id } = await params;
  const { dream, visible } = await loadVisible(id, session.user.id, session.user.role);
  if (!dream) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  if (!visible) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });

  return NextResponse.json(dream);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { id } = await params;
  const dream = await prisma.dream.findUnique({ where: { id } });
  if (!dream) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const locked = dream.lockedAt != null;
  const canAuthorEdit = dream.authorId === session.user.id && !locked;
  const canSuper = isSuper(session.user.role);
  if (!canAuthorEdit && !canSuper) {
    return NextResponse.json({ error: "Редактирование недоступно" }, { status: 403 });
  }

  const body = await req.json();
  const shortTitle = body.shortTitle != null ? String(body.shortTitle).trim() : undefined;
  const bodyRich = body.bodyRich != null ? String(body.bodyRich) : undefined;
  const status = body.status as string | undefined;

  const prevStatus = dream.status;
  const data: {
    shortTitle?: string;
    bodyRich?: string;
    status?: "DRAFTING" | "ACTIVE" | "FULFILLED" | "POSTPONED" | "DROPPED";
  } = {};

  if (shortTitle !== undefined) data.shortTitle = shortTitle;
  if (bodyRich !== undefined) data.bodyRich = bodyRich;
  if (status && ["DRAFTING", "ACTIVE", "FULFILLED", "POSTPONED", "DROPPED"].includes(status)) {
    data.status = status as typeof data.status;
  }

  const updated = await prisma.dream.update({
    where: { id },
    data,
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      supports: {
        include: { supporter: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });

  if (prevStatus !== "ACTIVE" && updated.status === "ACTIVE" && updated.supports.length > 0) {
    const authorName = updated.author.name ?? updated.author.id;
    for (const row of updated.supports) {
      if (row.responseStatus === "PENDING") {
        await createNotification({
          userId: row.supporterId,
          title: "Мечта активирована",
          body: `${authorName}: «${updated.shortTitle}». Согласуйте сембоны.`,
          linkUrl: `/dreams/${id}`,
        });
      }
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { id } = await params;
  const dream = await prisma.dream.findUnique({ where: { id } });
  if (!dream) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const can = dream.authorId === session.user.id || isSuper(session.user.role);
  if (!can) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });

  await prisma.dream.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
