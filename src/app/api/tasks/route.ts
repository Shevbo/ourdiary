import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskRecurrenceKind } from "@prisma/client";
import { initialNextDueUtc } from "@/lib/task-recurrence";
import { taskInclude } from "@/lib/task-flow";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const assigneeId = searchParams.get("assigneeId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (assigneeId) where.assigneeId = assigneeId;

  const tasks = await prisma.task.findMany({
    where,
    include: taskInclude,
    orderBy: [{ nextDueAt: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(tasks);
}

function parseRecurrenceKind(v: unknown): TaskRecurrenceKind {
  const s = String(v ?? "NONE").toUpperCase();
  if (s === "DAILY" || s === "WEEKLY" || s === "MONTHLY" || s === "YEARLY") return s as TaskRecurrenceKind;
  return "NONE";
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const body = await req.json();
  const { title, description, dueDate, assigneeId, points, authorSeeksSembons, isRecurring, recurrenceKind, recurrencePayload, activateNow } =
    body as Record<string, unknown>;

  if (!title || typeof title !== "string") return NextResponse.json({ error: "title обязателен" }, { status: 400 });

  const pts = Math.max(0, Math.min(9999, Number(points ?? 10)));
  const seeks = Boolean(authorSeeksSembons);
  const recurring = Boolean(isRecurring);
  const rk = parseRecurrenceKind(recurrenceKind);
  const payload = recurrencePayload && typeof recurrencePayload === "object" ? recurrencePayload : undefined;
  const due = dueDate ? new Date(String(dueDate)) : undefined;

  let nextDue: Date | undefined;
  if (recurring && rk !== "NONE") {
    nextDue = initialNextDueUtc(rk, payload, due ?? null, new Date());
  }

  let status: "DRAFT" | "IN_PROGRESS" = "DRAFT";
  if (activateNow === true && !seeks) {
    status = "IN_PROGRESS";
  } else if (activateNow === true && seeks) {
    return NextResponse.json({ error: "С сембонами для постановщика сначала отправьте задачу на согласование" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      title: String(title).trim(),
      description: description != null ? String(description) : undefined,
      dueDate: due,
      nextDueAt: nextDue ?? due,
      assigneeId: assigneeId ? String(assigneeId) : undefined,
      points: pts,
      authorSeeksSembons: seeks,
      isRecurring: recurring,
      recurrenceKind: recurring ? rk : "NONE",
      recurrencePayload: recurring && rk !== "NONE" ? (payload ?? {}) : undefined,
      status,
      authorId: session.user.id,
    },
    include: taskInclude,
  });

  return NextResponse.json(task, { status: 201 });
}
