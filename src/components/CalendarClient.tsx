"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn, EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "@/lib/utils";

type CalEvent = {
  id: string;
  title: string;
  type: string;
  date: string;
  endDate: string | null;
  description: string | null;
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

export default function CalendarClient({
  events,
  year,
  month,
}: {
  events: CalEvent[];
  year: number;
  month: number;
}) {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  // Monday-based: 0=Mon..6=Sun
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const eventsByDay: Record<number, CalEvent[]> = {};
  for (const ev of events) {
    const d = new Date(ev.date).getDate();
    if (!eventsByDay[d]) eventsByDay[d] = [];
    eventsByDay[d].push(ev);
  }

  function navigate(delta: number) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1) { newMonth = 12; newYear--; }
    router.push(`/calendar?year=${newYear}&month=${newMonth}`);
  }

  const selectedEvents = selectedDay ? (eventsByDay[selectedDay] ?? []) : [];
  const monthLabel = format(new Date(year, month - 1, 1), "LLLL yyyy", { locale: ru });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-2xl font-bold">Календарь</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-white font-semibold capitalize min-w-36 text-center">{monthLabel}</span>
          <button
            onClick={() => navigate(1)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-2">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-slate-500 text-xs font-medium py-2">{d}</div>
            ))}
          </div>
          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDow }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = eventsByDay[day] ?? [];
              const today = new Date();
              const isToday =
                today.getFullYear() === year &&
                today.getMonth() + 1 === month &&
                today.getDate() === day;
              const isSelected = selectedDay === day;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={cn(
                    "relative aspect-square flex flex-col items-center justify-start pt-1.5 rounded-lg text-sm transition-colors",
                    isSelected
                      ? "bg-indigo-600 text-white"
                      : isToday
                      ? "bg-slate-700 text-white"
                      : "text-slate-300 hover:bg-slate-800"
                  )}
                >
                  <span className={cn("font-medium", isToday && !isSelected && "text-indigo-400")}>
                    {day}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className={cn("w-1.5 h-1.5 rounded-full", TYPE_DOTS[ev.type] ?? "bg-slate-400")}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4">
            {Object.entries(TYPE_DOTS).map(([type, dot]) => (
              <div key={type} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className={cn("w-2 h-2 rounded-full", dot)} />
                {EVENT_TYPE_LABELS[type]}
              </div>
            ))}
          </div>
        </div>

        {/* Day detail */}
        <div className="lg:col-span-1">
          {selectedDay ? (
            <div>
              <h2 className="text-white font-semibold mb-3">
                {selectedDay} {format(new Date(year, month - 1, 1), "MMMM", { locale: ru })}
              </h2>
              {selectedEvents.length === 0 ? (
                <p className="text-slate-500 text-sm">Нет событий в этот день</p>
              ) : (
                <div className="space-y-3">
                  {selectedEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", EVENT_TYPE_COLORS[ev.type])}>
                          {EVENT_TYPE_LABELS[ev.type]}
                        </span>
                      </div>
                      <p className="text-white text-sm font-medium">{ev.title}</p>
                      {ev.description && (
                        <p className="text-slate-400 text-xs mt-1 line-clamp-2">{ev.description}</p>
                      )}
                      {ev.links.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {ev.links.map((l) => (
                            <a
                              key={l.id}
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-400 hover:text-indigo-300"
                            >
                              {l.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-500 text-sm">
              <Calendar className="w-8 h-8 mb-2 opacity-30" />
              <p>Выберите день для просмотра событий</p>
              <p className="mt-3 text-xs">Всего событий в месяце: {events.length}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
