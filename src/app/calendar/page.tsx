import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CalendarClient from "@/components/CalendarClient";
import { endOfDay, endOfWeek, isValid, parseISO, startOfDay, startOfWeek } from "date-fns";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; view?: string; date?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const params = await searchParams;
  const now = new Date();
  const view =
    params.view === "week" || params.view === "day" ? params.view : "month";

  const anchorRaw = params.date ? parseISO(params.date) : now;
  const anchor = isValid(anchorRaw) ? anchorRaw : now;

  let year = params.year ? parseInt(params.year, 10) : anchor.getFullYear();
  let month = params.month ? parseInt(params.month, 10) : anchor.getMonth() + 1;
  if (!Number.isFinite(year)) year = anchor.getFullYear();
  if (!Number.isFinite(month)) month = anchor.getMonth() + 1;

  let from: Date;
  let to: Date;

  if (view === "month") {
    const y = Number.isFinite(year) ? year : anchor.getFullYear();
    const m = Number.isFinite(month) ? month : anchor.getMonth() + 1;
    from = new Date(y, m - 1, 1);
    to = new Date(y, m, 0, 23, 59, 59, 999);
  } else if (view === "week") {
    from = startOfWeek(anchor, { weekStartsOn: 1 });
    to = endOfWeek(anchor, { weekStartsOn: 1 });
  } else {
    from = startOfDay(anchor);
    to = endOfDay(anchor);
  }

  const events = await prisma.event.findMany({
    where: { date: { gte: from, lte: to } },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      links: true,
    },
    orderBy: { date: "asc" },
  });

  type EventRow = (typeof events)[number];
  const serialized = events.map((e: EventRow) => ({
    id: e.id,
    title: e.title,
    type: e.type,
    date: e.date.toISOString(),
    endDate: e.endDate?.toISOString() ?? null,
    imageUrl: e.imageUrl,
    author: e.author,
    links: e.links,
    description: e.description,
  }));

  return (
    <CalendarClient
      events={serialized}
      view={view}
      year={year}
      month={month}
      anchorDateISO={anchor.toISOString()}
    />
  );
}
