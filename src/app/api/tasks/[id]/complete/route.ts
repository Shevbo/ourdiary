import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { advanceRecurringAfterFinalDone, awardTaskPoints, taskInclude } from "@/lib/task-flow";
import { notifyAdmins } from "@/lib/notify-admins";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (task.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Выполнить можно только задачу «в работе»" }, { status: 400 });
  }

  const role = session.user.role;
  const isAdmin = role === "ADMIN" || role === "SUPERADMIN";
  const isAssignee = task.assigneeId === session.user.id;
  const universal = task.assigneeId == null;
  const canComplete = isAdmin || isAssignee || universal;
  if (!canComplete) {
    return NextResponse.json(
      { error: "Выполнить может исполнитель, любой член семьи (если не назначен) или администратор" },
      { status: 403 }
    );
  }

  const completerId = task.assigneeId ?? session.user.id;

  if (task.points > 0) {
    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: "IN_REVIEW",
        completedBy: session.user.id,
        completedAt: new Date(),
      },
      include: taskInclude,
    });

    await notifyAdmins({
      title: "Задача на приёмке",
      body: `«${task.title}» — примите выполнение или откройте карточку.`,
      linkUrl: `/tasks/${id}`,
    });

    return NextResponse.json(updated);
  }

  await prisma.task.update({
    where: { id },
    data: {
      status: "DONE",
      completedBy: session.user.id,
      completedAt: new Date(),
    },
  });

  await awardTaskPoints(task, completerId);
  await advanceRecurringAfterFinalDone(task);

  const updated = await prisma.task.findUnique({
    where: { id },
    include: taskInclude,
  });

  return NextResponse.json(updated);
}
