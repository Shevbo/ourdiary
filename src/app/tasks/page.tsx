import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import TasksClient from "@/components/TasksClient";
import { markOverdueTasks } from "@/lib/mark-overdue-tasks";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  await markOverdueTasks();

  const [tasks, users] = await Promise.all([
    prisma.task.findMany({
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        completer: { select: { id: true, name: true, avatarUrl: true } },
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: [{ nextDueAt: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.user.findMany({ where: { isServiceUser: false }, select: { id: true, name: true } }),
  ]);

  type TaskRow = (typeof tasks)[number];
  const serialized = tasks.map((t: TaskRow) => ({
    ...t,
    dueDate: t.dueDate?.toISOString() ?? null,
    nextDueAt: t.nextDueAt?.toISOString() ?? null,
    seriesEndsAt: t.seriesEndsAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <TasksClient
      tasks={serialized}
      users={users}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
    />
  );
}
