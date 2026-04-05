import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initialNextDueUtc } from "@/lib/task-recurrence";
import { taskInclude } from "@/lib/task-flow";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { id } = await params;
  const src = await prisma.task.findUnique({ where: { id } });
  if (!src) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const recurring = src.isRecurring && src.recurrenceKind !== "NONE";
  const nextDue =
    recurring && src.recurrenceKind
      ? initialNextDueUtc(src.recurrenceKind, src.recurrencePayload, src.dueDate ?? src.nextDueAt, new Date())
      : src.dueDate ?? src.nextDueAt;

  let assigneeId = src.assigneeId;
  if (assigneeId) {
    const u = await prisma.user.findUnique({ where: { id: assigneeId } });
    if (!u || u.isServiceUser) assigneeId = null;
  }

  const copy = await prisma.task.create({
    data: {
      title: src.title,
      description: src.description,
      dueDate: src.dueDate,
      seriesEndsAt: src.seriesEndsAt,
      nextDueAt: nextDue,
      points: src.points,
      authorSeeksSembons: false,
      isRecurring: src.isRecurring,
      recurrenceKind: src.recurrenceKind,
      recurrencePayload: src.recurrencePayload === null ? undefined : (src.recurrencePayload as object),
      status: "DRAFT",
      authorId: session.user.id,
      assigneeId,
    },
    include: taskInclude,
  });

  return NextResponse.json(copy, { status: 201 });
}
