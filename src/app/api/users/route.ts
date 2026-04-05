import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { isServiceUser: false },
    select: { id: true, name: true, email: true, avatarUrl: true, role: true, isServiceUser: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}
