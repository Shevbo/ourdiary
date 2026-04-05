import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: appNewsId } = await params;
  const { value } = await req.json();
  if (value !== "UP" && value !== "DOWN") {
    return NextResponse.json({ error: "value должен быть UP или DOWN" }, { status: 400 });
  }

  const news = await prisma.appNews.findUnique({ where: { id: appNewsId } });
  if (!news) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.appNewsVote.findUnique({
    where: { userId_appNewsId: { userId: session.user.id, appNewsId } },
  });

  if (existing) {
    if (existing.value === value) {
      await prisma.appNewsVote.delete({ where: { id: existing.id } });
      return NextResponse.json({ action: "removed" });
    }
    const updated = await prisma.appNewsVote.update({
      where: { id: existing.id },
      data: { value },
    });
    return NextResponse.json({ action: "updated", vote: updated });
  }

  const vote = await prisma.appNewsVote.create({
    data: { userId: session.user.id, appNewsId, value },
  });

  return NextResponse.json({ action: "created", vote }, { status: 201 });
}
