import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshDreamLock } from "@/lib/dream-lock";

function isSuper(role: string) {
  return role === "SUPERADMIN";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; supportId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { id: dreamId, supportId } = await params;
  const row = await prisma.dreamSupport.findFirst({
    where: { id: supportId, dreamId },
    include: { dream: true },
  });
  if (!row) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  if (row.supporterId !== session.user.id && !isSuper(session.user.role)) {
    return NextResponse.json({ error: "Только выбранный участник" }, { status: 403 });
  }
  if (row.dream.lockedAt) return NextResponse.json({ error: "Мечта зафиксирована" }, { status: 403 });

  const body = await req.json();
  const action = String(body.action ?? "");

  if (action === "decline") {
    const updated = await prisma.dreamSupport.update({
      where: { id: supportId },
      data: {
        responseStatus: "DECLINED",
        agreedSembons: null,
      },
    });
    await refreshDreamLock(dreamId);
    return NextResponse.json(updated);
  }

  if (action === "agree") {
    const agreed = parseInt(String(body.agreedSembons ?? row.requestedSembons), 10);
    if (!Number.isFinite(agreed) || agreed < 1) {
      return NextResponse.json({ error: "Укажите согласованное количество сембонов" }, { status: 400 });
    }
    const updated = await prisma.dreamSupport.update({
      where: { id: supportId },
      data: {
        responseStatus: "AGREED",
        agreedSembons: agreed,
      },
    });
    await refreshDreamLock(dreamId);
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "action: agree | decline" }, { status: 400 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; supportId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { id: dreamId, supportId } = await params;
  const row = await prisma.dreamSupport.findFirst({
    where: { id: supportId, dreamId },
    include: { dream: true },
  });
  if (!row) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  if (row.dream.lockedAt) return NextResponse.json({ error: "Мечта зафиксирована" }, { status: 403 });
  if (row.dream.authorId !== session.user.id && !isSuper(session.user.role)) {
    return NextResponse.json({ error: "Только автор" }, { status: 403 });
  }

  await prisma.dreamSupport.delete({ where: { id: supportId } });
  return NextResponse.json({ ok: true });
}
