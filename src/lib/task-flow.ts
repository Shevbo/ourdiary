import type { Prisma, Task, TaskRecurrenceKind } from "@prisma/client";
import { prisma } from "./prisma";
import { computeNextDueUtc } from "./task-recurrence";

const taskInclude = {
  assignee: { select: { id: true, name: true, avatarUrl: true } },
  completer: { select: { id: true, name: true, avatarUrl: true } },
  author: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export { taskInclude };

export async function awardTaskPoints(task: Task, completerUserId: string) {
  await prisma.ratingPoint.create({
    data: {
      userId: completerUserId,
      points: task.points,
      reason: `Выполнена задача: ${task.title}`,
      type: "TASK_DONE",
    },
  });
}

/** После финального DONE для регулярной задачи — новый цикл (одна строка в БД). */
export async function advanceRecurringAfterFinalDone(task: Task) {
  if (!task.isRecurring || task.recurrenceKind === "NONE") return;

  const base = task.nextDueAt ?? task.dueDate ?? new Date();
  const next = computeNextDueUtc(task.recurrenceKind as TaskRecurrenceKind, task.recurrencePayload, base);

  await prisma.task.update({
    where: { id: task.id },
    data: {
      status: "DRAFT",
      nextDueAt: next,
      dueDate: next,
      completedAt: null,
      completedBy: null,
    },
  });
}
