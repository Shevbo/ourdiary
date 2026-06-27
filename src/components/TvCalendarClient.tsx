"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarDays, QrCode } from "lucide-react";
import type { NumberedResult, TvView } from "@/lib/tv-calendar";

// Фолбэк-цвет карточки по типу события, если категория не задана.
const TYPE_FALLBACK_COLOR: Record<string, string> = {
  PLAN: "#3b82f6",
  BIRTHDAY: "#a855f7",
  HOLIDAY: "#f59e0b",
  REMINDER: "#ef4444",
  DIARY: "#64748b",
};

const VIEW_ORDER: TvView[] = ["month", "week", "feed"];
const VIEW_LABELS: Record<TvView, string> = {
  month: "Месяц",
  week: "Неделя",
  feed: "Лента",
};

type EventItem = NumberedResult["events"][number];

function eventColor(ev: EventItem): string {
  return ev.category?.color ?? TYPE_FALLBACK_COLOR[ev.type] ?? "#64748b";
}

export default function TvCalendarClient({
  data,
  legend,
}: {
  data: NumberedResult;
  legend: { name: string; color: string }[];
}) {
  const router = useRouter();
  const view = data.view;
  const anchor = useMemo(() => new Date(data.anchor), [data.anchor]);

  const go = useCallback(
    (nextView: TvView, nextAnchor: Date) => {
      const sp = new URLSearchParams();
      sp.set("view", nextView);
      sp.set("anchor", nextAnchor.toISOString());
      router.push(`/tv/calendar?${sp.toString()}`);
    },
    [router]
  );

  const shiftPeriod = useCallback(
    (dir: -1 | 1) => {
      if (view === "month") go(view, addMonths(anchor, dir));
      else if (view === "week") go(view, addWeeks(anchor, dir));
      else go(view, addDays(anchor, dir * 14));
    },
    [view, anchor, go]
  );

  const switchView = useCallback(
    (dir: -1 | 1) => {
      const idx = VIEW_ORDER.indexOf(view);
      const next = VIEW_ORDER[(idx + dir + VIEW_ORDER.length) % VIEW_ORDER.length];
      go(next, anchor);
    },
    [view, anchor, go]
  );

  // Навигация пультом (D-pad) через keydown на window.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          shiftPeriod(-1);
          break;
        case "ArrowRight":
          e.preventDefault();
          shiftPeriod(1);
          break;
        case "ArrowUp":
          e.preventDefault();
          switchView(-1);
          break;
        case "ArrowDown":
          e.preventDefault();
          switchView(1);
          break;
        case "1":
          go("month", anchor);
          break;
        case "2":
          go("week", anchor);
          break;
        case "3":
          go("feed", anchor);
          break;
        default:
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shiftPeriod, switchView, go, anchor]);

  const periodLabel = useMemo(() => {
    if (view === "month") return format(anchor, "LLLL yyyy", { locale: ru });
    if (view === "week") {
      const ws = startOfWeek(anchor, { weekStartsOn: 1 });
      const we = endOfWeek(anchor, { weekStartsOn: 1 });
      return `${format(ws, "d MMM", { locale: ru })} — ${format(we, "d MMM yyyy", { locale: ru })}`;
    }
    return `${format(new Date(data.from), "d MMM", { locale: ru })} — ${format(
      new Date(data.to),
      "d MMM yyyy",
      { locale: ru }
    )}`;
  }, [view, anchor, data.from, data.to]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col gap-4 overflow-auto bg-slate-950 p-6 text-white select-none">
      {/* Заголовок: вид + период + легенда */}
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500">
            <CalendarDays className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="text-4xl font-bold capitalize leading-none">{periodLabel}</div>
            <div className="mt-1 text-lg text-slate-400">
              ТВ-календарь · вид: <span className="text-slate-200">{VIEW_LABELS[view]}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-base text-slate-300">
          {legend.map((c) => (
            <span key={c.name} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
              {c.name}
            </span>
          ))}
        </div>
      </header>

      <main className="min-h-0 flex-1">
        {view === "month" && <MonthView data={data} anchor={anchor} />}
        {view === "week" && <WeekView data={data} anchor={anchor} />}
        {view === "feed" && <FeedView data={data} />}
      </main>

      <footer className="text-center text-sm text-slate-500">
        ← / → — период · ↑ / ↓ — вид · 1 месяц · 2 неделя · 3 лента
      </footer>
    </div>
  );
}

// ─── МЕСЯЦ ───────────────────────────────────────────────────────────────────
function MonthView({ data, anchor }: { data: NumberedResult; anchor: Date }) {
  const gridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weekdayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  const byDay = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const ev of data.events) {
      const key = format(new Date(ev.date), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return map;
  }, [data.events]);

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 gap-2 pb-2 text-lg font-semibold text-slate-400">
        {weekdayNames.map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid flex-1 auto-rows-fr grid-cols-7 gap-2">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = byDay.get(key) ?? [];
          const inMonth = isSameMonth(day, anchor);
          const today = isSameDay(day, new Date());
          return (
            <div
              key={key}
              className={`flex min-h-0 flex-col overflow-hidden rounded-xl border p-1.5 ${
                inMonth ? "border-slate-800 bg-slate-900" : "border-slate-900 bg-slate-950/60"
              } ${today ? "ring-2 ring-indigo-400" : ""}`}
            >
              <div
                className={`mb-1 text-right text-base font-semibold ${
                  inMonth ? "text-slate-300" : "text-slate-600"
                }`}
              >
                {format(day, "d")}
              </div>
              <div className="flex min-h-0 flex-col gap-1 overflow-hidden">
                {dayEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium leading-tight text-white"
                    style={{ backgroundColor: eventColor(ev) }}
                  >
                    <span className="shrink-0 rounded bg-black/30 px-1 text-xs font-bold tabular-nums">
                      {ev.n}
                    </span>
                    <span className="truncate">{ev.title}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── НЕДЕЛЯ ──────────────────────────────────────────────────────────────────
function WeekView({ data, anchor }: { data: NumberedResult; anchor: Date }) {
  const ws = startOfWeek(anchor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

  const byDay = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const ev of data.events) {
      const key = format(new Date(ev.date), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return map;
  }, [data.events]);

  return (
    <div className="grid h-full grid-cols-7 gap-3">
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const dayEvents = byDay.get(key) ?? [];
        const today = isSameDay(day, new Date());
        return (
          <div
            key={key}
            className={`flex min-h-0 flex-col gap-2 overflow-auto rounded-2xl border border-slate-800 bg-slate-900 p-3 ${
              today ? "ring-2 ring-indigo-400" : ""
            }`}
          >
            <div className="text-center">
              <div className="text-base capitalize text-slate-400">{format(day, "EEE", { locale: ru })}</div>
              <div className="text-3xl font-bold text-slate-200">{format(day, "d")}</div>
            </div>
            <div className="flex flex-col gap-2">
              {dayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-lg p-2 text-white"
                  style={{ backgroundColor: eventColor(ev) }}
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-black/30 px-1.5 py-0.5 text-base font-bold tabular-nums">
                      {ev.n}
                    </span>
                    <span className="text-base tabular-nums opacity-90">
                      {format(new Date(ev.date), "HH:mm")}
                    </span>
                  </div>
                  <div className="mt-1 text-lg font-semibold leading-tight">{ev.title}</div>
                  {ev.category && <div className="text-sm opacity-90">{ev.category.name}</div>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ЛЕНТА ───────────────────────────────────────────────────────────────────
function FeedView({ data }: { data: NumberedResult }) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      {data.events.length === 0 && (
        <p className="text-center text-2xl text-slate-500">Нет событий в этом диапазоне</p>
      )}
      {data.events.map((ev) => {
        const color = eventColor(ev);
        return (
          <article
            key={ev.id}
            className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900"
            style={{ borderLeft: `8px solid ${color}` }}
          >
            <div className="flex gap-5 p-6">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl font-bold text-white tabular-nums"
                  style={{ backgroundColor: color }}
                >
                  {ev.n}
                </div>
                <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl border border-dashed border-slate-600 text-slate-500">
                  <QrCode className="h-7 w-7" />
                  <span className="text-[10px]">QR</span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-3xl font-bold leading-tight">{ev.title}</h3>
                  {ev.category && (
                    <span
                      className="rounded-full px-3 py-0.5 text-base font-medium text-white"
                      style={{ backgroundColor: color }}
                    >
                      {ev.category.name}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xl capitalize text-slate-400">
                  {format(new Date(ev.date), "EEEE, d MMMM yyyy · HH:mm", { locale: ru })}
                </div>
                {ev.description && (
                  <p className="mt-3 text-xl leading-relaxed text-slate-200">{ev.description}</p>
                )}
                {ev.authorName && (
                  <p className="mt-2 text-base text-slate-500">{ev.authorName}</p>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
