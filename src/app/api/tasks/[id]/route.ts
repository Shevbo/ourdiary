import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  if (task.status === "DONE") return NextResponse.json({ error: "Задача уже выполнена" }, { status: 400 });

  const allowed = task.authorId === session.user.id || isAdmin(session.user.role);
  if (!allowed) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });

  const body = await req.json();
  const { title, description, dueDate, assigneeId, points } = body;

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      ...(assigneeId !== undefined ? { assigneeId: assigneeId ? String(assigneeId) : null } : {}),
      ...(points !== undefined ? { points: Number(points) } : {}),
    },
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      completer: { select: { id: true, name: true, avatarUrl: true } },
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return NextResponse.json(updated);
}
