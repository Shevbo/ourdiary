import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const places = await prisma.expensePlace.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(places);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name обязателен" }, { status: 400 });

  try {
    const place = await prisma.expensePlace.create({
      data: { name },
    });
    return NextResponse.json(place, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Такое место уже есть" }, { status: 409 });
  }
}
