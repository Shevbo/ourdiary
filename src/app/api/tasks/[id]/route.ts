import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma, TaskRecurrenceKind, TaskStatus } from "@prisma/client";
import { initialNextDueUtc } from "@/lib/task-recurrence";
import { taskInclude } from "@/lib/task-flow";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

function parseRecurrenceKind(v: unknown): TaskRecurrenceKind {
  const s = String(v ?? "NONE").toUpperCase();
  if (s === "DAILY" || s === "WEEKLY" || s === "MONTHLY" || s === "YEARLY") return s as TaskRecurrenceKind;
  return "NONE";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: taskInclude,
  });
  if (!task) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  if (task.status === "DONE" || task.status === "CANCELLED") {
    return NextResponse.json({ error: "Задача закрыта" }, { status: 400 });
  }

  const allowed = task.authorId === session.user.id || isAdmin(session.user.role);
  if (!allowed) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });

  const body = await req.json();
  const {
    title,
    description,
    dueDate,
    seriesEndsAt,
    assigneeId,
    points,
    authorSeeksSembons,
    isRecurring,
    recurrenceKind,
    recurrencePayload,
    status,
  } = body as Record<string, unknown>;

  const data: Prisma.TaskUncheckedUpdateInput = {};

  if (title !== undefined) data.title = String(title).trim();
  if (description !== undefined) data.description = description === null ? null : String(description);
  if (dueDate !== undefined) {
    const d = dueDate ? new Date(String(dueDate)) : null;
    data.dueDate = d;
    if (d && d.getTime() > Date.now() && task.status === "OVERDUE") {
      data.status = "IN_PROGRESS";
    }
  }
  if (seriesEndsAt !== undefined) {
    data.seriesEndsAt = seriesEndsAt ? new Date(String(seriesEndsAt)) : null;
  }
  if (assigneeId !== undefined) {
    if (assigneeId) {
      const u = await prisma.user.findUnique({ where: { id: String(assigneeId) } });
      if (!u || u.isServiceUser) {
        return NextResponse.json({ error: "Нельзя назначить этого исполнителя" }, { status: 400 });
      }
    }
    data.assigneeId = assigneeId ? String(assigneeId) : null;
  }
  if (points !== undefined) data.points = Math.max(0, Math.min(9999, Number(points)));
  if (authorSeeksSembons !== undefined) data.authorSeeksSembons = Boolean(authorSeeksSembons);
  if (isRecurring !== undefined) data.isRecurring = Boolean(isRecurring);

  if (recurrenceKind !== undefined || recurrencePayload !== undefined || isRecurring !== undefined) {
    const rec = isRecurring !== undefined ? Boolean(isRecurring) : task.isRecurring;
    const rk = recurrenceKind !== undefined ? parseRecurrenceKind(recurrenceKind) : task.recurrenceKind;
    const payload =
      recurrencePayload !== undefined && recurrencePayload !== null && typeof recurrencePayload === "object"
        ? recurrencePayload
        : task.recurrencePayload;

    data.recurrenceKind = rec ? rk : "NONE";
    data.recurrencePayload =
      rec && rk !== "NONE" ? (payload as Prisma.InputJsonValue) : Prisma.JsonNull;

    const due = (dueDate !== undefined ? (dueDate ? new Date(String(dueDate)) : null) : task.dueDate) as Date | null;
    if (rec && rk !== "NONE") {
      const next = initialNextDueUtc(rk, payload, due, new Date());
      data.nextDueAt = next;
      if (next.getTime() > Date.now() && task.status === "OVERDUE") {
        data.status = "IN_PROGRESS";
      }
    } else if (!rec) {
      data.nextDueAt = null;
    }
  }

  if (status !== undefined) {
    const s = String(status).toUpperCase() as TaskStatus;
    if (s === "POSTPONED") {
      if (!["DRAFT", "IN_PROGRESS", "APPROVAL_PENDING", "OVERDUE"].includes(task.status)) {
        return NextResponse.json({ error: "Отложить можно из черновика, согласования, в работе или просрочки" }, { status: 400 });
      }
      data.status = "POSTPONED";
    } else if (s === "CANCELLED") {
      data.status = "CANCELLED";
    } else if (s === "DRAFT" || s === "IN_PROGRESS" || s === "APPROVAL_PENDING") {
      data.status = s;
    } else {
      return NextResponse.json({ error: "Этот статус меняется через действия на странице задачи" }, { status: 400 });
    }
  }

  const updated = await prisma.task.update({
    where: { id },
    data,
    include: taskInclude,
  });

  return NextResponse.json(updated);
}
