import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAlice } from "@/lib/alice-auth";

export async function GET(req: NextRequest) {
  const denied = requireAlice(req);
  if (denied) return denied;

  const categories = await prisma.category.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const denied = requireAlice(req);
  if (denied) return denied;

  let body: { name?: string; color?: string; icon?: string; order?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Невалидный JSON" }, { status: 400 });
  }

  const { name, color, icon, order } = body;
  if (!name || !color) {
    return NextResponse.json({ error: "name и color обязательны" }, { status: 400 });
  }

  let resolvedOrder = order;
  if (resolvedOrder === undefined) {
    const max = await prisma.category.aggregate({ _max: { order: true } });
    resolvedOrder = (max._max.order ?? 0) + 1;
  }

  const category = await prisma.category.create({
    data: { name, color, icon: icon ?? null, order: resolvedOrder },
  });

  return NextResponse.json(category, { status: 201 });
}
