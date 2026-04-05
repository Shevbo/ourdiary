import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }
  const rows = await prisma.expenseCategoryDefinition.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  return NextResponse.json({ categories: rows });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }
  const body = await req.json();
  const code = String(body.code ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_");
  const label = String(body.label ?? "").trim();
  if (!code || !label) {
    return NextResponse.json({ error: "Код и название обязательны" }, { status: 400 });
  }
  const sortOrder = parseInt(String(body.sortOrder ?? "0"), 10) || 0;
  try {
    const row = await prisma.expenseCategoryDefinition.create({
      data: { code, label, sortOrder, isActive: body.isActive !== false },
    });
    return NextResponse.json(row, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Такой код уже есть" }, { status: 409 });
  }
}
