import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (task.status === "DONE") return NextResponse.json({ error: "Уже выполнено" }, { status: 400 });

  const role = session.user.role;
  const isAdmin = role === "ADMIN" || role === "SUPERADMIN";
  const isAssignee = task.assigneeId === session.user.id;
  const universal = task.assigneeId == null;
  const canComplete = isAdmin || isAssignee || universal;
  if (!canComplete) {
    return NextResponse.json({ error: "Выполнить может только администратор, исполнитель или любой член семьи, если исполнитель не назначен" }, { status: 403 });
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      status: "DONE",
      completedBy: session.user.id,
      completedAt: new Date(),
    },
    include: {
      completer: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  await prisma.ratingPoint.create({
    data: {
      userId: session.user.id,
      points: task.points,
      reason: `Выполнена задача: ${task.title}`,
      type: "TASK_DONE",
    },
  });

  return NextResponse.json(updated);
}
