import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskRecurrenceKind } from "@prisma/client";
import { initialNextDueUtc } from "@/lib/task-recurrence";
import { taskInclude } from "@/lib/task-flow";
import { markOverdueTasks } from "@/lib/mark-overdue-tasks";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  await markOverdueTasks();

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
  const { title, description, dueDate, seriesEndsAt, assigneeId, points, isRecurring, recurrenceKind, recurrencePayload, status: bodyStatus } =
    body as Record<string, unknown>;

  if (!title || typeof title !== "string") return NextResponse.json({ error: "title обязателен" }, { status: 400 });

  const pts = Math.max(0, Math.min(9999, Number(points ?? 0)));
  const recurring = Boolean(isRecurring);
  const rk = parseRecurrenceKind(recurrenceKind);
  const payload = recurrencePayload && typeof recurrencePayload === "object" ? recurrencePayload : undefined;
  const due = dueDate ? new Date(String(dueDate)) : undefined;
  const seriesEnd = seriesEndsAt ? new Date(String(seriesEndsAt)) : undefined;

  if (assigneeId) {
    const u = await prisma.user.findUnique({ where: { id: String(assigneeId) } });
    if (!u || u.isServiceUser) {
      return NextResponse.json({ error: "Нельзя назначить этого исполнителя" }, { status: 400 });
    }
  }

  let nextDue: Date | undefined;
  if (recurring && rk !== "NONE") {
    nextDue = initialNextDueUtc(rk, payload, due ?? null, new Date());
  }

  let initialStatus: "DRAFT" | "IN_PROGRESS" | "APPROVAL_PENDING" | "POSTPONED" | "CANCELLED" = "DRAFT";
  if (bodyStatus) {
    const s = String(bodyStatus).toUpperCase();
    if (["DRAFT", "IN_PROGRESS", "APPROVAL_PENDING", "POSTPONED", "CANCELLED"].includes(s)) {
      initialStatus = s as typeof initialStatus;
    }
  }

  const task = await prisma.task.create({
    data: {
      title: String(title).trim(),
      description: description != null ? String(description) : undefined,
      dueDate: due,
      seriesEndsAt: recurring && rk !== "NONE" ? seriesEnd : undefined,
      nextDueAt: nextDue ?? due,
      assigneeId: assigneeId ? String(assigneeId) : undefined,
      points: pts,
      authorSeeksSembons: false,
      isRecurring: recurring,
      recurrenceKind: recurring ? rk : "NONE",
      recurrencePayload: recurring && rk !== "NONE" ? (payload ?? {}) : undefined,
      status: initialStatus,
      authorId: session.user.id,
    },
    include: taskInclude,
  });

  return NextResponse.json(task, { status: 201 });
}
