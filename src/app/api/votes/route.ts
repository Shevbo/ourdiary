import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId, value } = await req.json();
  if (!eventId || !value) return NextResponse.json({ error: "eventId и value обязательны" }, { status: 400 });

  const existing = await prisma.vote.findUnique({
    where: { userId_eventId: { userId: session.user.id, eventId } },
  });

  if (existing) {
    if (existing.value === value) {
      await prisma.vote.delete({ where: { id: existing.id } });
      return NextResponse.json({ action: "removed" });
    }
    const updated = await prisma.vote.update({
      where: { id: existing.id },
      data: { value },
    });
    return NextResponse.json({ action: "updated", vote: updated });
  }

  const vote = await prisma.vote.create({
    data: { userId: session.user.id, eventId, value },
  });

  await prisma.ratingPoint.create({
    data: {
      userId: session.user.id,
      points: 1,
      reason: "Голосование",
      type: "VOTE_CAST",
    },
  });

  return NextResponse.json({ action: "created", vote }, { status: 201 });
}
