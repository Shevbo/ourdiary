import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { advanceRecurringAfterFinalDone, awardTaskPoints, taskInclude } from "@/lib/task-flow";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String((body as { action?: string }).action ?? "");

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const isAuthor = task.authorId === session.user.id;
  const admin = isAdmin(session.user.role);

  async function respond() {
    const updated = await prisma.task.findUnique({
      where: { id },
      include: taskInclude,
    });
    return NextResponse.json(updated);
  }

  switch (action) {
    case "activate": {
      if (task.status !== "DRAFT") return NextResponse.json({ error: "Доступно из черновика" }, { status: 400 });
      if (!isAuthor && !admin) return NextResponse.json({ error: "Только постановщик или админ" }, { status: 403 });
      if (task.authorSeeksSembons && !admin) {
        return NextResponse.json(
          { error: "Отправьте задачу на согласование администратору (сембоны постановщика)" },
          { status: 400 }
        );
      }
      await prisma.task.update({ where: { id }, data: { status: "IN_PROGRESS" } });
      return respond();
    }
    case "submitApproval": {
      if (task.status !== "DRAFT") return NextResponse.json({ error: "Только из черновика" }, { status: 400 });
      if (!isAuthor && !admin) return NextResponse.json({ error: "Только постановщик или админ" }, { status: 403 });
      if (!task.authorSeeksSembons) {
        return NextResponse.json({ error: "Для этой задачи согласование не требуется — активируйте сразу" }, { status: 400 });
      }
      await prisma.task.update({ where: { id }, data: { status: "APPROVAL_PENDING" } });
      const { notifyAdmins } = await import("@/lib/notify-admins");
      await notifyAdmins({
        title: "Согласование задачи",
        body: `«${task.title}» — согласуйте активацию.`,
        linkUrl: `/tasks/${id}`,
      });
      return respond();
    }
    case "approveActivation": {
      if (!admin) return NextResponse.json({ error: "Только администратор" }, { status: 403 });
      if (task.status !== "APPROVAL_PENDING") return NextResponse.json({ error: "Нет запроса на активацию" }, { status: 400 });
      await prisma.task.update({ where: { id }, data: { status: "IN_PROGRESS" } });
      return respond();
    }
    case "approveCompletion": {
      if (!admin) return NextResponse.json({ error: "Только администратор" }, { status: 403 });
      if (task.status !== "IN_REVIEW") return NextResponse.json({ error: "Нет задачи на приёмке" }, { status: 400 });
      const completerId = task.completedBy ?? task.assigneeId ?? session.user.id;
      await prisma.task.update({
        where: { id },
        data: { status: "DONE" },
      });
      await awardTaskPoints(task, completerId);
      await advanceRecurringAfterFinalDone(task);
      return respond();
    }
    case "resume": {
      if (!isAuthor && !admin) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
      if (task.status !== "POSTPONED") return NextResponse.json({ error: "Только для отложенной" }, { status: 400 });
      await prisma.task.update({ where: { id }, data: { status: "DRAFT" } });
      return respond();
    }
    default:
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  }
}
