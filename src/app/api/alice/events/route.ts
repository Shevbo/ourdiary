import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAlice, getServiceUserId } from "@/lib/alice-auth";
import { findOrCreateCategoryByName } from "@/lib/tv-calendar";
import { EventType } from "@prisma/client";

export async function GET(req: NextRequest) {
  const denied = requireAlice(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (from || to) {
    const date: Record<string, unknown> = {};
    if (from) date.gte = new Date(from);
    if (to) date.lte = new Date(to);
    where.date = date;
  }

  const events = await prisma.event.findMany({
    where,
    include: {
      category: { select: { name: true, color: true, icon: true } },
      author: { select: { id: true, name: true } },
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const denied = requireAlice(req);
  if (denied) return denied;

  let body: {
    title?: string;
    date?: string;
    type?: string;
    description?: string;
    categoryName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Невалидный JSON" }, { status: 400 });
  }

  const { title, date, type, description, categoryName } = body;
  if (!title || !date) {
    return NextResponse.json({ error: "title и date обязательны" }, { status: 400 });
  }

  const categoryId = categoryName?.trim()
    ? await findOrCreateCategoryByName(categoryName)
    : null;

  const authorId = await getServiceUserId();

  const event = await prisma.event.create({
    data: {
      title,
      description: description ?? null,
      type: (type as EventType) ?? EventType.PLAN,
      date: new Date(date),
      authorId,
      categoryId,
    },
    include: {
      category: { select: { name: true, color: true, icon: true } },
      author: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(event, { status: 201 });
}
