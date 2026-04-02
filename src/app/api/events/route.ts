import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (from || to) {
    where.date = {};
    if (from) (where.date as Record<string, unknown>).gte = new Date(from);
    if (to) (where.date as Record<string, unknown>).lte = new Date(to);
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        links: true,
        _count: { select: { comments: true, votes: true } },
        votes: { where: { userId: session.user.id } },
      },
      orderBy: { date: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.event.count({ where }),
  ]);

  return NextResponse.json({ events, total });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description, type, date, endDate, imageUrl, links } = body;

  if (!title || !date) {
    return NextResponse.json({ error: "title и date обязательны" }, { status: 400 });
  }

  const event = await prisma.event.create({
    data: {
      title,
      description,
      type: type ?? "DIARY",
      date: new Date(date),
      endDate: endDate ? new Date(endDate) : undefined,
      imageUrl,
      authorId: session.user.id,
      links: links?.length
        ? { create: links.map((l: { label: string; url: string }) => ({ label: l.label, url: l.url })) }
        : undefined,
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      links: true,
    },
  });

  // Начислить рейтинговые очки за создание события
  await prisma.ratingPoint.create({
    data: {
      userId: session.user.id,
      points: 5,
      reason: `Создано событие: ${title}`,
      type: "EVENT_CREATED",
    },
  });

  return NextResponse.json(event, { status: 201 });
}
