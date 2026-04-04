import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import DreamsListClient from "@/components/DreamsListClient";

export const dynamic = "force-dynamic";

export default async function DreamsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return <DreamsListClient />;
}
