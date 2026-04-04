import { prisma } from "@/lib/prisma";
import { format, addDays } from "date-fns";
import { ru } from "date-fns/locale";
import TvClient from "@/components/TvClient";

export const dynamic = "force-dynamic";

export default async function TvPage() {
  const now = new Date();
  const in7days = addDays(now, 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [upcomingEvents, topUsers, recentDiary, monthExpenses] = await Promise.all([
    prisma.event.findMany({
      where: {
        type: { in: ["PLAN", "BIRTHDAY", "HOLIDAY", "REMINDER"] },
        date: { gte: now, lte: in7days },
        status: "ACTIVE",
      },
      include: { author: { select: { name: true } } },
      orderBy: { date: "asc" },
      take: 8,
    }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        sembonManualAdjust: true,
        ratingPoints: { select: { points: true } },
      },
    }),
    prisma.event.findMany({
      where: { type: "DIARY", status: "ACTIVE" },
      include: { author: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 3,
    }),
    prisma.expense.findMany({
      where: { date: { gte: monthStart, lte: monthEnd } },
      select: { amount: true, category: true },
    }),
  ]);

  type TopUser = typeof topUsers[number];
  type LeaderEntry = { id: string; name: string | null; avatarUrl: string | null; points: number };
  const leaderboard: LeaderEntry[] = topUsers
    .map((u: TopUser) => ({
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      points:
        u.ratingPoints.reduce((s: number, p: { points: number }) => s + p.points, 0) + u.sembonManualAdjust,
    }))
    .sort((a: LeaderEntry, b: LeaderEntry) => b.points - a.points)
    .slice(0, 3);

  const monthTotal = monthExpenses.reduce((s: number, e: { amount: unknown }) => s + Number(e.amount), 0);

  type UpcomingEvent = typeof upcomingEvents[number];
  type DiaryEvent = typeof recentDiary[number];
  const data = {
    upcomingEvents: upcomingEvents.map((e: UpcomingEvent) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      date: e.date.toISOString(),
      authorName: e.author.name,
    })),
    leaderboard,
    recentDiary: recentDiary.map((e: DiaryEvent) => ({
      id: e.id,
      title: e.title,
      date: e.date.toISOString(),
      description: e.description,
      authorName: e.author.name,
    })),
    monthTotal,
    monthLabel: format(now, "LLLL yyyy", { locale: ru }),
  };

  return <TvClient data={data} />;
}
