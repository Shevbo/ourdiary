import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import DreamDetailClient from "@/components/DreamDetailClient";

export const dynamic = "force-dynamic";

export default async function DreamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { id } = await params;

  return <DreamDetailClient dreamId={id} />;
}
