import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAlice } from "@/lib/alice-auth";
import { findOrCreateCategoryByName } from "@/lib/tv-calendar";
import { EventType, EventStatus } from "@prisma/client";

const eventInclude = {
  category: { select: { name: true, color: true, icon: true } },
  author: { select: { id: true, name: true } },
} as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAlice(req);
  if (denied) return denied;

  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, include: eventInclude });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(event);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAlice(req);
  if (denied) return denied;

  const { id } = await params;
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: {
    title?: string;
    description?: string;
    date?: string;
    type?: string;
    status?: string;
    categoryName?: string;
    categoryId?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Невалидный JSON" }, { status: 400 });
  }

  let categoryId: string | null | undefined = undefined;
  if (body.categoryName?.trim()) {
    categoryId = await findOrCreateCategoryByName(body.categoryName);
  } else if (body.categoryId !== undefined) {
    categoryId = body.categoryId;
  }

  const updated = await prisma.event.update({
    where: { id },
    data: {
      title: body.title ?? undefined,
      description: body.description,
      date: body.date ? new Date(body.date) : undefined,
      type: body.type ? (body.type as EventType) : undefined,
      status: body.status ? (body.status as EventStatus) : undefined,
      ...(categoryId !== undefined ? { categoryId } : {}),
    },
    include: eventInclude,
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAlice(req);
  if (denied) return denied;

  const { id } = await params;
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.event.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
