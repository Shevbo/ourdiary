import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: appNewsId } = await params;
  const { text } = await req.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text обязателен" }, { status: 400 });
  }

  const news = await prisma.appNews.findUnique({ where: { id: appNewsId } });
  if (!news) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const comment = await prisma.appNewsComment.create({
    data: { text: text.trim(), authorId: session.user.id, appNewsId },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });

  return NextResponse.json(comment, { status: 201 });
}
