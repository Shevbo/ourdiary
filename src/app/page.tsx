import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import FeedClient from "@/components/FeedClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const appNews = await prisma.appNews.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, body: true, createdAt: true },
  });

  const events = await prisma.event.findMany({
    take: 50,
    orderBy: { date: "desc" },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      links: true,
      _count: { select: { comments: true, votes: true } },
      votes: { where: { userId: session.user.id } },
      reactions: { select: { emoji: true, userId: true } },
    },
  });

  function packReactions(rows: { emoji: string; userId: string }[], uid: string) {
    const map = new Map<string, { emoji: string; count: number; me: boolean }>();
    for (const r of rows) {
      const cur = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, me: false };
      cur.count += 1;
      if (r.userId === uid) cur.me = true;
      map.set(r.emoji, cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }

  type EventRow = typeof events[number];
  const serialized = events.map((e: EventRow) => ({
    ...e,
    date: e.date.toISOString(),
    endDate: e.endDate?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    votes: e.votes.map((v: { value: "UP" | "DOWN"; userId: string }) => ({ value: v.value, userId: v.userId })),
    reactions: packReactions(e.reactions, session.user.id),
  }));

  const newsSerialized = appNews.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <FeedClient
      appNews={newsSerialized}
      events={serialized}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
    />
  );
}
