import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import FeedClient from "@/components/FeedClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const events = await prisma.event.findMany({
    take: 50,
    orderBy: { date: "desc" },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      links: true,
      _count: { select: { comments: true, votes: true } },
      votes: { where: { userId: session.user.id } },
    },
  });

  type EventRow = typeof events[number];
  const serialized = events.map((e: EventRow) => ({
    ...e,
    date: e.date.toISOString(),
    endDate: e.endDate?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    votes: e.votes.map((v: { value: "UP" | "DOWN"; userId: string }) => ({ value: v.value, userId: v.userId })),
  }));

  return (
    <FeedClient
      events={serialized}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
    />
  );
}
