"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { BookHeart, Calendar, Trophy, DollarSign, Medal, Award } from "lucide-react";
import { cn, EVENT_TYPE_LABELS, formatMoney } from "@/lib/utils";

type TvData = {
  upcomingEvents: { id: string; title: string; type: string; date: string; authorName: string | null }[];
  leaderboard: { id: string; name: string | null; avatarUrl: string | null; points: number }[];
  recentDiary: { id: string; title: string; date: string; description: string | null; authorName: string | null }[];
  monthTotal: number;
  monthLabel: string;
};

const EVENT_TYPE_BADGE: Record<string, string> = {
  PLAN: "bg-green-500/20 text-green-300",
  BIRTHDAY: "bg-pink-500/20 text-pink-300",
  HOLIDAY: "bg-orange-500/20 text-orange-300",
  REMINDER: "bg-yellow-500/20 text-yellow-300",
};

const medals = [
  <Trophy key="1" className="w-6 h-6 text-yellow-400" />,
  <Medal key="2" className="w-6 h-6 text-slate-300" />,
  <Award key="3" className="w-6 h-6 text-amber-600" />,
];

export default function TvClient({ data }: { data: TvData }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    const reload = setTimeout(() => window.location.reload(), 30000);
    return () => { clearInterval(tick); clearTimeout(reload); };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col gap-6 select-none">
      {/* Header: clock */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center">
            <BookHeart className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">Наш дневник</span>
        </div>
        <div className="text-right">
          <div className="text-5xl font-bold tabular-nums tracking-tight">
            {format(now, "HH:mm:ss")}
          </div>
          <div className="text-slate-400 text-lg capitalize">
            {format(now, "EEEE, d MMMM yyyy", { locale: ru })}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-3 gap-6">
        {/* Upcoming events */}
        <div className="col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <h2 className="text-slate-200 font-semibold text-lg">Ближайшие события</h2>
            <span className="text-slate-500 text-sm ml-auto">7 дней</span>
          </div>
          {data.upcomingEvents.length === 0 ? (
            <p className="text-slate-500 text-base">Нет запланированных событий</p>
          ) : (
            <div className="space-y-3 flex-1">
              {data.upcomingEvents.map((ev) => (
                <div key={ev.id} className="border-l-2 border-indigo-500 pl-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", EVENT_TYPE_BADGE[ev.type] ?? "bg-slate-700 text-slate-300")}>
                      {EVENT_TYPE_LABELS[ev.type] ?? ev.type}
                    </span>
                  </div>
                  <p className="text-white font-medium text-base leading-tight">{ev.title}</p>
                  <p className="text-slate-400 text-sm">
                    {format(new Date(ev.date), "d MMMM, HH:mm", { locale: ru })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent diary */}
        <div className="col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <BookHeart className="w-5 h-5 text-rose-400" />
            <h2 className="text-slate-200 font-semibold text-lg">Последние записи</h2>
          </div>
          {data.recentDiary.length === 0 ? (
            <p className="text-slate-500 text-base">Нет записей в дневнике</p>
          ) : (
            <div className="space-y-4 flex-1">
              {data.recentDiary.map((ev) => (
                <div key={ev.id}>
                  <p className="text-white font-semibold text-base">{ev.title}</p>
                  {ev.description && (
                    <p className="text-slate-400 text-sm mt-0.5 line-clamp-2">{ev.description}</p>
                  )}
                  <p className="text-slate-500 text-xs mt-1">
                    {ev.authorName} · {format(new Date(ev.date), "d MMMM", { locale: ru })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rating + expenses */}
        <div className="col-span-1 flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex-1">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <h2 className="text-slate-200 font-semibold text-lg">Рейтинг</h2>
            </div>
            <div className="space-y-3">
              {data.leaderboard.map((u, idx) => (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="flex-shrink-0">{medals[idx]}</div>
                  <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {u.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatarUrl} alt={u.name ?? ""} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-slate-300 font-bold text-sm">
                        {(u.name ?? "?")[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-base">{u.name ?? "—"}</p>
                  </div>
                  <span className="text-yellow-400 font-bold text-xl">{u.points}</span>
                </div>
              ))}
              {data.leaderboard.length === 0 && (
                <p className="text-slate-500 text-base">Нет данных</p>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <h2 className="text-slate-200 font-semibold text-lg">Расходы</h2>
              <span className="text-slate-500 text-sm ml-auto capitalize">{data.monthLabel}</span>
            </div>
            <p className="text-3xl font-bold text-white">{formatMoney(data.monthTotal)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
