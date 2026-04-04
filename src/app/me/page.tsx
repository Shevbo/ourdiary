import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-slate-900 dark:text-white text-2xl font-bold mb-2">Личный кабинет</h1>
      <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
        Раздел в разработке: профиль, уведомления, мечты и лимиты появятся в следующих итерациях (спринт 1.15).
      </p>
      <p className="text-slate-500 text-sm">
        Вы вошли как <span className="text-slate-800 dark:text-slate-200">{session.user.email}</span>
      </p>
    </div>
  );
}
