import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DreamsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-slate-900 dark:text-white text-2xl font-bold mb-2">Воплоти мечту</h1>
      <p className="text-slate-600 dark:text-slate-400 text-sm">
        Модуль мечт, согласований сембонов и иконок Дарумы запланирован отдельным этапом (п. 1.14): здесь будет
        список карточек, статусы и уведомления.
      </p>
    </div>
  );
}
