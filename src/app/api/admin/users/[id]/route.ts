import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findUserByEmailInsensitive } from "@/lib/user-by-email";
import { findUserByLoginNameInsensitive } from "@/lib/user-lookup";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  if (target.role === "SUPERADMIN" && session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Нельзя редактировать суперадмина" }, { status: 403 });
  }

  const body = await req.json();
  const loginName = body.loginName != null ? String(body.loginName).trim().toLowerCase() : undefined;
  const email = body.email != null ? String(body.email).trim().toLowerCase() : undefined;
  const name = body.name !== undefined ? (body.name === null ? null : String(body.name)) : undefined;
  const password = body.password != null ? String(body.password) : "";
  const isServiceUser = body.isServiceUser === true || body.isServiceUser === false ? Boolean(body.isServiceUser) : undefined;
  const sembonManualAdjust =
    body.sembonManualAdjust !== undefined ? parseInt(String(body.sembonManualAdjust), 10) : undefined;
  let monthlyBudgetByCategory: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined = undefined;
  if (body.monthlyBudgetByCategory !== undefined) {
    if (body.monthlyBudgetByCategory === null || body.monthlyBudgetByCategory === "") {
      monthlyBudgetByCategory = Prisma.JsonNull;
    } else if (typeof body.monthlyBudgetByCategory === "object") {
      monthlyBudgetByCategory = body.monthlyBudgetByCategory as Prisma.InputJsonValue;
    } else {
      try {
        monthlyBudgetByCategory = JSON.parse(String(body.monthlyBudgetByCategory)) as Prisma.InputJsonValue;
      } catch {
        return NextResponse.json({ error: "monthlyBudgetByCategory: невалидный JSON" }, { status: 400 });
      }
    }
  }

  if (loginName && loginName !== target.loginName) {
    const taken = await findUserByLoginNameInsensitive(loginName);
    if (taken && taken.id !== id) {
      return NextResponse.json({ error: "Такое имя для входа уже занято" }, { status: 409 });
    }
  }
  if (email && email !== target.email) {
    const taken = await findUserByEmailInsensitive(email);
    if (taken && taken.id !== id) {
      return NextResponse.json({ error: "Такой email уже занят" }, { status: 409 });
    }
  }

  const data: Prisma.UserUpdateInput = {
    ...(loginName !== undefined ? { loginName } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(name !== undefined ? { name } : {}),
    ...(isServiceUser !== undefined ? { isServiceUser } : {}),
    ...(Number.isFinite(sembonManualAdjust) ? { sembonManualAdjust } : {}),
    ...(monthlyBudgetByCategory !== undefined ? { monthlyBudgetByCategory } : {}),
  };

  if (password.length > 0) {
    if (password.length < 6) {
      return NextResponse.json({ error: "Пароль не короче 6 символов" }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(password, 12);
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      loginName: true,
      email: true,
      name: true,
      role: true,
      isServiceUser: true,
      sembonManualAdjust: true,
      monthlyBudgetByCategory: true,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "Нельзя удалить себя" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  if (target.role === "SUPERADMIN") {
    return NextResponse.json({ error: "Нельзя удалить суперадмина" }, { status: 403 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
