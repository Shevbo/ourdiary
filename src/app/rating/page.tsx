import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Star, Trophy, Medal, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const RATING_TYPE_LABELS: Record<string, string> = {
  TASK_DONE: "Выполнена задача",
  EVENT_CREATED: "Создано событие",
  VOTE_CAST: "Голосование",
  EXPENSE_ADDED: "Добавлен расход",
  BONUS: "Бонус",
  PENALTY: "Штраф",
};

export default async function RatingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      ratingPoints: {
        select: { id: true, points: true, type: true, reason: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  type UserRow = typeof users[number];
  type LeaderEntry = {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    totalPoints: number;
    history: UserRow["ratingPoints"];
  };
  const leaderboard: LeaderEntry[] = users
    .map((u: UserRow) => ({
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      totalPoints: u.ratingPoints.reduce((s: number, p: { points: number }) => s + p.points, 0),
      history: u.ratingPoints.slice(0, 10),
    }))
    .sort((a: LeaderEntry, b: LeaderEntry) => b.totalPoints - a.totalPoints);

  const medals = [
    <Trophy key="1" className="w-5 h-5 text-yellow-400" />,
    <Medal key="2" className="w-5 h-5 text-slate-300" />,
    <Award key="3" className="w-5 h-5 text-amber-600" />,
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Star className="w-6 h-6 text-yellow-400" />
        <h1 className="text-white text-2xl font-bold">Рейтинг семьянина</h1>
      </div>

      <div className="space-y-4">
        {leaderboard.map((user, idx) => (
          <div
            key={user.id}
            className={cn(
              "bg-slate-900 border rounded-xl p-4",
              idx === 0 ? "border-yellow-500/30" : "border-slate-800"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-8 text-center">
                {idx < 3 ? medals[idx] : (
                  <span className="text-slate-500 text-sm font-bold">#{idx + 1}</span>
                )}
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt={user.name ?? ""} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-slate-300 text-sm font-bold">
                    {(user.name ?? "?")[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold">{user.name ?? "Без имени"}</p>
                <p className="text-slate-500 text-xs">{user.history.length} последних действий</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-yellow-400 font-bold text-xl">{user.totalPoints}</p>
                <p className="text-slate-500 text-xs">очков</p>
              </div>
            </div>

            {user.history.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800">
                <p className="text-slate-500 text-xs font-medium mb-2">История начислений</p>
                <div className="space-y-1">
                  {user.history.map((h: UserRow["ratingPoints"][number]) => (
                    <div key={h.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 truncate">
                        {RATING_TYPE_LABELS[h.type] ?? h.type}: {h.reason}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className={cn(h.points >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {h.points >= 0 ? "+" : ""}{h.points}
                        </span>
                        <span className="text-slate-600">
                          {format(new Date(h.createdAt), "d MMM", { locale: ru })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {leaderboard.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <Star className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Пока нет участников с очками</p>
          </div>
        )}
      </div>
    </div>
  );
}
