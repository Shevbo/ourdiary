import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function canEditEvent(eventAuthorId: string, sessionUserId: string, role: string) {
  return eventAuthorId === sessionUserId || role === "ADMIN" || role === "SUPERADMIN";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      links: true,
      comments: {
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
      },
      votes: true,
      reactions: { select: { emoji: true, userId: true } },
    },
  });

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(event);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canEditEvent(event.authorId, session.user.id, session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const linksPayload = body.links as { label: string; url: string }[] | undefined;

  const updated = await prisma.$transaction(async (tx) => {
    if (linksPayload !== undefined) {
      await tx.eventLink.deleteMany({ where: { eventId: id } });
    }
    return tx.event.update({
      where: { id },
      data: {
        title: body.title ?? undefined,
        description: body.description,
        type: body.type,
        status: body.status,
        date: body.date ? new Date(body.date) : undefined,
        endDate: body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : undefined,
        imageUrl: body.imageUrl,
        ...(linksPayload !== undefined
          ? {
              links: {
                create: linksPayload
                  .filter((l) => l.label && l.url)
                  .map((l) => ({ label: l.label, url: l.url })),
              },
            }
          : {}),
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        links: true,
        _count: { select: { comments: true, votes: true } },
        votes: { where: { userId: session.user.id } },
      },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canEditEvent(event.authorId, session.user.id, session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.event.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
