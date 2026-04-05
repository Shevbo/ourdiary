import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPERADMIN";

  const users = await prisma.user.findMany({
    where: {
      isServiceUser: false,
      ...(!isAdmin ? { id: session.user.id } : {}),
    },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      sembonManualAdjust: true,
      ratingPoints: {
        select: { points: true, type: true, reason: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  type UserRow = typeof users[number];
  const leaderboard = users
    .map((u: UserRow) => ({
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      totalPoints:
        u.ratingPoints.reduce((sum: number, p: { points: number }) => sum + p.points, 0) + u.sembonManualAdjust,
      recentActivity: u.ratingPoints,
    }))
    .sort((a: { totalPoints: number }, b: { totalPoints: number }) => b.totalPoints - a.totalPoints);

  return NextResponse.json(leaderboard);
}
