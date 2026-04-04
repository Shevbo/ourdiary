import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminClient from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") redirect("/");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      loginName: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      avatarUrl: true,
      isServiceUser: true,
      sembonManualAdjust: true,
      monthlyBudgetByCategory: true,
    },
    orderBy: { createdAt: "asc" },
  });

  type UserSelect = typeof users[number];
  const serialized = users.map((u: UserSelect) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return <AdminClient users={serialized} currentUserId={session.user.id} />;
}
