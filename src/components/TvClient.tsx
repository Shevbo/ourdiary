"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { BookHeart, Calendar, Wallet, Medal, Award, DoorOpen } from "lucide-react";
import SembonIcon from "@/components/SembonIcon";
import { cn, EVENT_TYPE_LABELS, formatMoney } from "@/lib/utils";
import AvatarImg from "./AvatarImg";

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
  <SembonIcon key="1" className="h-6 w-6" title="1 место" />,
  <Medal key="2" className="w-6 h-6 text-slate-300" />,
  <Award key="3" className="w-6 h-6 text-amber-600" />,
];

export default function TvClient({ data }: { data: TvData }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [now, setNow] = useState(new Date());
  const x0 = useRef(0);
  const y0 = useRef(0);

  const isService = session?.user?.isServiceUser ?? false;

  function swipeExit(dx: number, dy: number) {
    if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy)) return;
    exitTv();
  }

  const exitTv = useCallback(() => {
    if (isService) {
      void signOut({ callbackUrl: "/login" });
    } else {
      router.push("/");
    }
  }, [isService, router]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    const reload = setTimeout(() => window.location.reload(), 30000);
    return () => {
      clearInterval(tick);
      clearTimeout(reload);
    };
  }, []);

  useEffect(() => {
    const o = screen.orientation;
    if (o && "lock" in o) {
      void (o as ScreenOrientation & { lock: (l: string) => Promise<void> })
        .lock("landscape")
        .catch(() => {});
    }
  }, []);

  function onTouchStart(e: React.TouchEvent) {
    x0.current = e.touches[0].clientX;
    y0.current = e.touches[0].clientY;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - x0.current;
    const dy = e.changedTouches[0].clientY - y0.current;
    swipeExit(dx, dy);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse") {
      x0.current = e.clientX;
      y0.current = e.clientY;
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    swipeExit(e.clientX - x0.current, e.clientY - y0.current);
  }

  return (
    <div
      className="fixed inset-0 z-[100] min-h-[100dvh] min-w-[100vw] overflow-auto overflow-x-hidden bg-slate-950 text-white p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 select-none touch-pan-y portrait:pt-14"
      style={{ minHeight: "100dvh" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[101] hidden portrait:flex items-center justify-center bg-amber-500/95 text-slate-900 text-sm font-medium px-3 py-2 text-center"
        role="status"
      >
        Поверните устройство горизонтально — режим TV только landscape
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center shrink-0">
            <BookHeart className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl sm:text-2xl font-bold text-white truncate">Наш дневник</span>
        </div>
        <div className="flex items-start gap-2 shrink-0">
          <div className="text-right">
            <div className="text-3xl sm:text-5xl font-bold tabular-nums tracking-tight">
              {format(now, "HH:mm:ss")}
            </div>
            <div className="text-slate-400 text-sm sm:text-lg capitalize">
              {format(now, "EEEE, d MMMM yyyy", { locale: ru })}
            </div>
          </div>
          {isService && (
            <button
              type="button"
              onClick={() => exitTv()}
              className="mt-0.5 rounded border border-slate-500/80 bg-slate-900/90 p-1 text-slate-100 hover:bg-slate-800"
              title="Выйти"
              aria-label="Выйти из аккаунта"
            >
              <DoorOpen className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 min-h-0">
        <div className="col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col min-h-[12rem]">
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
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        EVENT_TYPE_BADGE[ev.type] ?? "bg-slate-700 text-slate-300"
                      )}
                    >
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

        <div className="col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col min-h-[12rem]">
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

        <div className="col-span-1 flex flex-col gap-4 sm:gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex-1 min-h-0">
            <div className="flex items-center gap-2 mb-4">
              <SembonIcon className="h-6 w-6" title="Сембон" />
              <h2 className="text-slate-200 font-semibold text-lg">Рейтинг</h2>
            </div>
            <div className="space-y-3">
              {data.leaderboard.map((u, idx) => (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="flex-shrink-0">{medals[idx]}</div>
                  <AvatarImg src={u.avatarUrl} alt={u.name ?? ""} name={u.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-base">{u.name ?? "—"}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center justify-end gap-1">
                      <SembonIcon className="h-5 w-5" />
                      <span className="text-yellow-400 font-bold text-xl">{u.points}</span>
                    </span>
                    <span className="text-slate-500 text-xs">семб.</span>
                  </div>
                </div>
              ))}
              {data.leaderboard.length === 0 && <p className="text-slate-500 text-base">Нет данных</p>}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-5 h-5 text-emerald-400" />
              <h2 className="text-slate-200 font-semibold text-lg">Расходы</h2>
              <span className="text-slate-500 text-sm ml-auto capitalize">{data.monthLabel}</span>
            </div>
            <p className="text-3xl font-bold text-white">{formatMoney(data.monthTotal)}</p>
          </div>
        </div>
      </div>

      {!isService && (
        <p className="text-center text-slate-500 text-xs pb-2">
          Свайп (или перетаскивание мышью) влево или вправо — выйти из режима TV на ленту
        </p>
      )}
    </div>
  );
}
