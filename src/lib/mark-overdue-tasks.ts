import { prisma } from "./prisma";

/** Переводит задачи с истёкшим сроком в OVERDUE (дата и время в dueDate / nextDueAt). */
export async function markOverdueTasks() {
  const now = new Date();

  await prisma.task.updateMany({
    where: {
      status: { in: ["DRAFT", "APPROVAL_PENDING", "IN_PROGRESS"] },
      OR: [
        {
          isRecurring: false,
          dueDate: { not: null, lt: now },
        },
        {
          isRecurring: true,
          OR: [
            { nextDueAt: { not: null, lt: now } },
            { nextDueAt: null, dueDate: { not: null, lt: now } },
          ],
        },
      ],
    },
    data: { status: "OVERDUE" },
  });
}
