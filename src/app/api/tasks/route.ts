import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isAdminRole(role: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const assigneeId = searchParams.get("assigneeId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (assigneeId) where.assigneeId = assigneeId;

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      completer: { select: { id: true, name: true, avatarUrl: true } },
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Создавать задачи могут только администраторы" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, dueDate, assigneeId, points } = body;

  if (!title) return NextResponse.json({ error: "title обязателен" }, { status: 400 });

  const task = await prisma.task.create({
    data: {
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      assigneeId,
      points: points ?? 10,
      authorId: session.user.id,
    },
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return NextResponse.json(task, { status: 201 });
}
