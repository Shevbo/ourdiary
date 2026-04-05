"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
} from "lucide-react";
import AddEventModal from "./AddEventModal";
import EventDetailModal from "./EventDetailModal";
import {
  addDays,
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
  subDays,
  subWeeks,
} from "date-fns";
import { ru } from "date-fns/locale";
import { cn, EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "@/lib/utils";

type CalEvent = {
  id: string;
  title: string;
  type: string;
  date: string;
  endDate: string | null;
  description: string | null;
  imageUrl: string | null;
  author: { id: string; name: string | null; avatarUrl: string | null };
  links: { id: string; label: string; url: string }[];
};

const TYPE_DOTS: Record<string, string> = {
  DIARY: "bg-blue-400",
  PLAN: "bg-green-400",
  BIRTHDAY: "bg-pink-400",
  HOLIDAY: "bg-orange-400",
  REMINDER: "bg-yellow-400",
};

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EventThumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="w-10 h-10 shrink-0 rounded-lg bg-slate-200 dark:bg-slate-700" aria-hidden />
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="h-10 w-10 shrink-0 rounded-lg object-cover"
      loading="lazy"
    />
  );
}

function EventMiniCard({ ev, onOpen }: { ev: CalEvent; onOpen?: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-lg border border-slate-200/80 bg-white/90 p-2 text-left shadow-sm transition-colors hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:border-indigo-600"
    >
      <div className="flex gap-2">
        <EventThumb url={ev.imageUrl} />
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "mb-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium",
              EVENT_TYPE_COLORS[ev.type]
            )}
          >
            {EVENT_TYPE_LABELS[ev.type]}
          </span>
          <p className="line-clamp-2 text-xs font-medium text-slate-900 dark:text-white">{ev.title}</p>
          {ev.description && (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600 dark:text-slate-400">{ev.description}</p>
          )}
        </div>
      </div>
    </button>
  );
}

function EventDayCard({ ev, onOpen }: { ev: CalEvent; onOpen?: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm text-left transition-colors hover:border-indigo-300 dark:hover:border-indigo-700"
    >
      <div className="flex gap-4">
        {ev.imageUrl ? (
          <img
            src={ev.imageUrl}
            alt=""
            className="h-24 w-24 shrink-0 rounded-xl object-cover sm:h-28 sm:w-28"
            loading="lazy"
          />
        ) : (
          <div className="h-24 w-24 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-800 sm:h-28 sm:w-28" />
        )}
        <div className="min-w-0 flex-1">
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", EVENT_TYPE_COLORS[ev.type])}>
            {EVENT_TYPE_LABELS[ev.type]}
          </span>
          <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{ev.title}</h3>
          {ev.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">{ev.description}</p>
          )}
          {ev.links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
              {ev.links.map((l) => (
                <a
                  key={l.id}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {l.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default function CalendarClient({
  events,
  year,
  month,
  view,
  anchorDateISO,
  currentUserId,
}: {
  events: CalEvent[];
  view: "month" | "week" | "day";
  year: number;
  month: number;
  anchorDateISO: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [presetDateForNew, setPresetDateForNew] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const anchor = parseISO(anchorDateISO);

  const lastTouchRef = useRef<{ key: string; t: number } | null>(null);
  const dblTapBlockClickRef = useRef(false);

  function openAddForDate(d: Date) {
    setPresetDateForNew(toDatetimeLocal(d));
    setShowAddModal(true);
  }

  function openAddFromToolbar() {
    const d = new Date(anchor);
    d.setHours(12, 0, 0, 0);
    openAddForDate(d);
  }

  function touchDoubleTap(key: string, onDouble: () => void, e: React.TouchEvent) {
    const now = Date.now();
    const prev = lastTouchRef.current;
    if (prev && prev.key === key && now - prev.t < 400) {
      e.preventDefault();
      lastTouchRef.current = null;
      dblTapBlockClickRef.current = true;
      setTimeout(() => {
        dblTapBlockClickRef.current = false;
      }, 500);
      onDouble();
      return;
    }
    lastTouchRef.current = { key, t: now };
  }

  const eventsByDayOfMonth = useMemo(() => {
    const map: Record<number, CalEvent[]> = {};
    for (const ev of events) {
      const d = new Date(ev.date).getDate();
      if (!map[d]) map[d] = [];
      map[d].push(ev);
    }
    return map;
  }, [events]);

  function navigateMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    router.push(`/calendar?view=month&year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
  }

  function navigateWeek(delta: number) {
    const next = delta > 0 ? addWeeks(anchor, 1) : subWeeks(anchor, 1);
    router.push(`/calendar?view=week&date=${format(next, "yyyy-MM-dd")}`);
  }

  function navigateDay(delta: number) {
    const next = delta > 0 ? addDays(anchor, 1) : subDays(anchor, 1);
    router.push(`/calendar?view=day&date=${format(next, "yyyy-MM-dd")}`);
  }

  function setView(next: "month" | "week" | "day") {
    if (next === "month") {
      router.push(`/calendar?view=month&year=${year}&month=${month}`);
    } else {
      router.push(`/calendar?view=${next}&date=${format(anchor, "yyyy-MM-dd")}`);
    }
  }

  const monthLabel = format(new Date(year, month - 1, 1), "LLLL yyyy", { locale: ru });
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, "d MMM", { locale: ru })} — ${format(weekEnd, "d MMM yyyy", { locale: ru })}`;
  const dayLabel = format(anchor, "EEEE, d MMMM yyyy", { locale: ru });

  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const selectedEvents = selectedDay ? (eventsByDayOfMonth[selectedDay] ?? []) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Календарь</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openAddFromToolbar()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 min-h-11 sm:min-h-0"
          >
            <Plus className="h-4 w-4" />
            Событие
          </button>
          {(["month", "week", "day"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-11 sm:min-h-0",
                view === v
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              )}
            >
              {v === "month" ? "Месяц" : v === "week" ? "Неделя" : "День"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (view === "month") navigateMonth(-1);
            else if (view === "week") navigateWeek(-1);
            else navigateDay(-1);
          }}
          className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="min-w-0 flex-1 text-center font-semibold capitalize text-slate-900 dark:text-white">
          {view === "month" && monthLabel}
          {view === "week" && weekLabel}
          {view === "day" && dayLabel}
        </span>
        <button
          type="button"
          onClick={() => {
            if (view === "month") navigateMonth(1);
            else if (view === "week") navigateWeek(1);
            else navigateDay(1);
          }}
          className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {view === "month" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-2 grid grid-cols-7">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-slate-500">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startDow }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayEvents = eventsByDayOfMonth[day] ?? [];
                const today = new Date();
                const isToday =
                  today.getFullYear() === year &&
                  today.getMonth() + 1 === month &&
                  today.getDate() === day;
                const isSelected = selectedDay === day;

                const tapKey = `m-${year}-${month}-${day}`;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      if (dblTapBlockClickRef.current) return;
                      setSelectedDay(isSelected ? null : day);
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      openAddForDate(new Date(year, month - 1, day, 12, 0, 0, 0));
                    }}
                    onTouchEnd={(e) =>
                      touchDoubleTap(tapKey, () => openAddForDate(new Date(year, month - 1, day, 12, 0, 0, 0)), e)
                    }
                    className={cn(
                      "relative flex min-h-[44px] flex-col items-center justify-start rounded-lg pt-1.5 text-sm transition-colors sm:aspect-square sm:min-h-0",
                      isSelected
                        ? "bg-indigo-600 text-white shadow-md"
                        : isToday
                          ? "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-300 dark:bg-slate-700 dark:text-white dark:ring-slate-600"
                          : "text-slate-800 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                    )}
                  >
                    <span className={cn("font-medium", isToday && !isSelected && "text-indigo-700 dark:text-indigo-300")}>
                      {day}
                    </span>
                    {dayEvents.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <span
                            key={ev.id}
                            className={cn("h-1.5 w-1.5 rounded-full", TYPE_DOTS[ev.type] ?? "bg-slate-400")}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {Object.entries(TYPE_DOTS).map(([type, dot]) => (
                <div key={type} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <span className={cn("h-2 w-2 rounded-full", dot)} />
                  {EVENT_TYPE_LABELS[type]}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            {selectedDay ? (
              <div>
                <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">
                  {selectedDay} {format(new Date(year, month - 1, 1), "MMMM", { locale: ru })}
                </h2>
                {selectedEvents.length === 0 ? (
                  <p className="text-sm text-slate-500">Нет событий в этот день</p>
                ) : (
                  <div className="space-y-3">
                    {selectedEvents.map((ev) => (
                      <EventMiniCard key={ev.id} ev={ev} onOpen={() => setDetailId(ev.id)} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-500">
                <CalendarIcon className="mb-2 h-8 w-8 opacity-40" />
                <p>Выберите день для просмотра событий</p>
                <p className="mt-3 text-xs">Всего событий в месяце: {events.length}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="space-y-3 pb-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Строки — дни с понедельника по воскресенье; в строке — события этой даты.
          </p>
          {weekDays.map((day) => {
            const dayEvents = events.filter((ev) => isSameDay(parseISO(ev.date), day));
            const weekTapKey = `w-${day.toISOString()}`;
            const dayNoon = new Date(day);
            dayNoon.setHours(12, 0, 0, 0);
            return (
              <div
                key={day.toISOString()}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:flex-row sm:items-start dark:border-slate-800 dark:bg-slate-900/40"
              >
                <div
                  className="w-full shrink-0 border-b border-slate-200 pb-2 sm:w-28 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3 dark:border-slate-700 cursor-default select-none"
                  onDoubleClick={() => openAddForDate(dayNoon)}
                  onTouchEnd={(e) => touchDoubleTap(weekTapKey, () => openAddForDate(dayNoon), e)}
                  title="Двойной тап — новое событие в этот день"
                >
                  <div className="text-[11px] font-medium uppercase text-slate-500">{format(day, "EEEE", { locale: ru })}</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">{format(day, "d.MM")}</div>
                </div>
                <div className="flex min-h-[44px] flex-1 flex-wrap content-start gap-2">
                  {dayEvents.length === 0 ? (
                    <span className="text-sm text-slate-400">Нет событий</span>
                  ) : (
                    dayEvents.map((ev) => <EventMiniCard key={ev.id} ev={ev} onOpen={() => setDetailId(ev.id)} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "day" && (
        <div className="flex min-h-[50vh] flex-col space-y-4">
          {(() => {
            const dayNoon = new Date(anchor);
            dayNoon.setHours(12, 0, 0, 0);
            const dayTapKey = `d-${format(anchor, "yyyy-MM-dd")}`;
            return (
              <>
                {events.length === 0 ? (
                  <p
                    className="flex min-h-[120px] items-center justify-center text-center text-slate-500"
                    onDoubleClick={() => openAddForDate(dayNoon)}
                    onTouchEnd={(e) => touchDoubleTap(dayTapKey, () => openAddForDate(dayNoon), e)}
                  >
                    Нет событий в этот день. Двойной тап здесь — добавить событие.
                  </p>
                ) : (
                  <>
                    {events.map((ev) => (
                      <EventDayCard key={ev.id} ev={ev} onOpen={() => setDetailId(ev.id)} />
                    ))}
                    <div
                      className="min-h-[100px] flex-1 rounded-xl"
                      onDoubleClick={() => openAddForDate(dayNoon)}
                      onTouchEnd={(e) => touchDoubleTap(`${dayTapKey}-pad`, () => openAddForDate(dayNoon), e)}
                      aria-hidden
                    />
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}

      {showAddModal && (
        <AddEventModal
          initialDateForNew={presetDateForNew}
          onClose={() => {
            setShowAddModal(false);
            setPresetDateForNew(null);
          }}
          onSaved={() => {
            setShowAddModal(false);
            setPresetDateForNew(null);
            router.refresh();
          }}
        />
      )}
      {detailId && (
        <EventDetailModal eventId={detailId} currentUserId={currentUserId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
