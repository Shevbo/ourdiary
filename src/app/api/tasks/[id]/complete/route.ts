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

  const updated = await prisma.task.update({
    where: { id },
    data: {
      status: "DONE",
      completedBy: session.user.id,
      completedAt: new Date(),
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
