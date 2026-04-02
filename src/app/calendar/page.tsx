import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CalendarClient from "@/components/CalendarClient";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const params = await searchParams;
  const now = new Date();
  const year = parseInt(params.year ?? String(now.getFullYear()));
  const month = parseInt(params.month ?? String(now.getMonth() + 1));

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);

  const events = await prisma.event.findMany({
    where: { date: { gte: from, lte: to } },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      links: true,
    },
    orderBy: { date: "asc" },
  });

  type EventRow = typeof events[number];
  const serialized = events.map((e: EventRow) => ({
    id: e.id,
    title: e.title,
    type: e.type,
    date: e.date.toISOString(),
    endDate: e.endDate?.toISOString() ?? null,
    author: e.author,
    links: e.links,
    description: e.description,
  }));

  return <CalendarClient events={serialized} year={year} month={month} />;
}
