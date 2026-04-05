import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import TaskDetailClient from "@/components/TaskDetailClient";
import { taskInclude } from "@/lib/task-flow";
import { markOverdueTasks } from "@/lib/mark-overdue-tasks";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  await markOverdueTasks();

  const { id } = await params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: taskInclude,
  });
  if (!task) notFound();

  const serialized = {
    ...task,
    dueDate: task.dueDate?.toISOString() ?? null,
    nextDueAt: task.nextDueAt?.toISOString() ?? null,
    seriesEndsAt: task.seriesEndsAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };

  return (
    <TaskDetailClient task={serialized} currentUserId={session.user.id} currentUserRole={session.user.role} />
  );
}
