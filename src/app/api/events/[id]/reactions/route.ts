import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EMOJI_MAX = 16;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: eventId } = await params;
  const body = await req.json().catch(() => ({}));
  const emoji = String((body as { emoji?: string }).emoji ?? "").trim();
  if (!emoji || emoji.length > EMOJI_MAX) {
    return NextResponse.json({ error: "emoji обязателен" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.eventReaction.findUnique({
    where: { eventId_userId_emoji: { eventId, userId: session.user.id, emoji } },
  });

  if (existing) {
    await prisma.eventReaction.delete({ where: { id: existing.id } });
    return NextResponse.json({ action: "removed" as const, emoji });
  }

  await prisma.eventReaction.create({
    data: { eventId, userId: session.user.id, emoji },
  });
  return NextResponse.json({ action: "created" as const, emoji });
}
