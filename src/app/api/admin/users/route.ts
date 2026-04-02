import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

function isAdminSession(role: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminSession(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, role } = await req.json();
  if (!userId || !role) return NextResponse.json({ error: "userId и role обязательны" }, { status: 400 });
  if (userId === session.user.id) return NextResponse.json({ error: "Нельзя изменить свою роль" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role === "SUPERADMIN") return NextResponse.json({ error: "Нельзя изменить роль суперадмина" }, { status: 403 });

  const allowed = ["MEMBER", "ADMIN"];
  if (!allowed.includes(role)) return NextResponse.json({ error: "Недопустимая роль" }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, email: true, role: true },
  });

  return NextResponse.json(updated);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminSession(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, name, password, role } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "email и password обязательны" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Пользователь с таким email уже существует" }, { status: 409 });

  const allowed = ["MEMBER", "ADMIN"];
  const userRole = allowed.includes(role) ? role : "MEMBER";

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, name: name || undefined, passwordHash, role: userRole },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json(user, { status: 201 });
}
