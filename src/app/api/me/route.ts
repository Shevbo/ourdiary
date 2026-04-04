import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findUserByEmailInsensitive } from "@/lib/user-by-email";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      loginName: true,
      email: true,
      name: true,
      avatarUrl: true,
      bioNote: true,
      role: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const unread = await prisma.notification.count({
    where: { userId: session.user.id, readAt: null },
  });

  return NextResponse.json({ ...user, unreadNotifications: unread });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const body = await req.json();
  const name = body.name !== undefined ? (body.name === null ? null : String(body.name)) : undefined;
  const bioNote = body.bioNote !== undefined ? (body.bioNote === null ? null : String(body.bioNote)) : undefined;
  const email = body.email != null ? String(body.email).trim().toLowerCase() : undefined;
  const password = body.password != null ? String(body.password) : "";

  const data: {
    name?: string | null;
    bioNote?: string | null;
    email?: string;
    passwordHash?: string;
  } = {};

  if (name !== undefined) data.name = name;
  if (bioNote !== undefined) data.bioNote = bioNote;

  if (email) {
    const other = await findUserByEmailInsensitive(email);
    if (other && other.id !== session.user.id) {
      return NextResponse.json({ error: "Этот email уже занят" }, { status: 409 });
    }
    data.email = email;
  }

  if (password.length > 0) {
    if (password.length < 6) {
      return NextResponse.json({ error: "Пароль не короче 6 символов" }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(password, 12);
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true,
      loginName: true,
      email: true,
      name: true,
      avatarUrl: true,
      bioNote: true,
    },
  });

  return NextResponse.json(updated);
}
