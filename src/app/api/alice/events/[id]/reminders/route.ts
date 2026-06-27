import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAlice } from "@/lib/alice-auth";

interface ReminderInput {
  remindAt?: string;
  recipient?: string;
  text?: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAlice(req);
  if (denied) return denied;

  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const reminders = await prisma.reminder.findMany({
    where: { eventId: id },
    orderBy: { remindAt: "asc" },
  });
  return NextResponse.json({ reminders });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAlice(req);
  if (denied) return denied;

  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { reminders?: ReminderInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Невалидный JSON" }, { status: 400 });
  }

  const items = body.reminders;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "reminders[] is required" }, { status: 400 });
  }

  const rows: { eventId: string; remindAt: Date; recipient: string; text: string | null }[] = [];
  for (const it of items) {
    if (!it || typeof it.remindAt !== "string" || typeof it.recipient !== "string" || !it.recipient.trim()) {
      return NextResponse.json(
        { error: "each reminder needs remindAt (ISO) and recipient" },
        { status: 400 }
      );
    }
    const remindAt = new Date(it.remindAt);
    if (Number.isNaN(remindAt.getTime())) {
      return NextResponse.json({ error: `invalid remindAt: ${it.remindAt}` }, { status: 400 });
    }
    rows.push({
      eventId: id,
      remindAt,
      recipient: it.recipient.trim(),
      text: typeof it.text === "string" && it.text.trim() ? it.text.trim() : null,
    });
  }

  const result = await prisma.reminder.createMany({ data: rows });
  return NextResponse.json({ created: result.count });
}
