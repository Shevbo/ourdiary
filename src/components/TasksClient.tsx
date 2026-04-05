"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Plus, X, CheckCircle2, Clock, AlertCircle, Circle, Pencil, ClipboardCopy, FileEdit, Send, Hourglass, Gavel } from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

type User = { id: string; name: string | null };
type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  nextDueAt: string | null;
  points: number;
  authorSeeksSembons: boolean;
  isRecurring: boolean;
  recurrenceKind: string;
  recurrencePayload: unknown;
  authorId: string;
  assigneeId: string | null;
  author: User | null;
  assignee: User | null;
  completer: User | null;
  completedAt: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  APPROVAL_PENDING: "Согласование",
  IN_PROGRESS: "В работе",
  IN_REVIEW: "Приёмка",
  DONE: "Сделана",
  POSTPONED: "Отложена",
  CANCELLED: "Отменена",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-200 dark:bg-slate-500/20 text-slate-700 dark:text-slate-400",
  APPROVAL_PENDING: "bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-400",
  IN_PROGRESS: "bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400",
  IN_REVIEW: "bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-400",
  DONE: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400",
  POSTPONED: "bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-400",
  CANCELLED: "bg-slate-300 dark:bg-slate-600/30 text-slate-600 dark:text-slate-500",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  DRAFT: <FileEdit className="w-4 h-4" />,
  APPROVAL_PENDING: <Send className="w-4 h-4" />,
  IN_PROGRESS: <Clock className="w-4 h-4" />,
  IN_REVIEW: <Gavel className="w-4 h-4" />,
  DONE: <CheckCircle2 className="w-4 h-4" />,
  POSTPONED: <Hourglass className="w-4 h-4" />,
  CANCELLED: <AlertCircle className="w-4 h-4" />,
};

const STATUS_ICON_RING: Record<string, string> = {
  DRAFT: "text-slate-500 dark:text-slate-400",
  APPROVAL_PENDING: "text-amber-600 dark:text-amber-400",
  IN_PROGRESS: "text-blue-600 dark:text-blue-400",
  IN_REVIEW: "text-violet-600 dark:text-violet-400",
  DONE: "text-emerald-600 dark:text-emerald-400",
  POSTPONED: "text-orange-600 dark:text-orange-400",
  CANCELLED: "text-slate-500",
};

const WEEKDAYS = [
  { v: 1, l: "Пн" },
  { v: 2, l: "Вт" },
  { v: 3, l: "Ср" },
  { v: 4, l: "Чт" },
  { v: 5, l: "Пт" },
  { v: 6, l: "Сб" },
  { v: 0, l: "Вс" },
];

export default function TasksClient({
  tasks: initialTasks,
  users,
  currentUserId,
  currentUserRole,
}: {
  tasks: Task[];
  users: User[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [completing, setCompleting] = useState<string | null>(null);
  const router = useRouter();

  const isAdmin = currentUserRole === "ADMIN" || currentUserRole === "SUPERADMIN";

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [points, setPoints] = useState("10");
  const [assigneeId, setAssigneeId] = useState("");
  const [authorSeeksSembons, setAuthorSeeksSembons] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceKind, setRecurrenceKind] = useState("NONE");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [dayOfMonth, setDayOfMonth] = useState("15");
  const [yearMonth, setYearMonth] = useState("1");
  const [yearDay, setYearDay] = useState("1");
  const [activateNow, setActivateNow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    let list = tasks;
    if (filterStatus) list = list.filter((t) => t.status === filterStatus);
    if (filterAssignee) list = list.filter((t) => t.assignee?.id === filterAssignee);
    return list;
  }, [tasks, filterStatus, filterAssignee]);

  function canComplete(task: Task) {
    if (task.status !== "IN_PROGRESS") return false;
    if (isAdmin) return true;
    if (task.assigneeId && task.assigneeId === currentUserId) return true;
    if (!task.assigneeId) return true;
    return false;
  }

  function canEdit(task: Task) {
    return task.authorId === currentUserId || isAdmin;
  }

  function toggleWeekday(v: number) {
    setWeekdays((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b)));
  }

  function buildRecurrencePayload(): object | undefined {
    if (!isRecurring || recurrenceKind === "NONE") return undefined;
    if (recurrenceKind === "WEEKLY") return { weekdays: weekdays.length ? weekdays : [1, 2, 3, 4, 5] };
    if (recurrenceKind === "MONTHLY") return { dayOfMonth: Math.min(31, Math.max(1, parseInt(dayOfMonth, 10) || 1)) };
    if (recurrenceKind === "YEARLY")
      return {
        month: Math.min(12, Math.max(1, parseInt(yearMonth, 10) || 1)),
        day: Math.min(31, Math.max(1, parseInt(yearDay, 10) || 1)),
      };
    return {};
  }

  function openCreate() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setDueDate("");
    setPoints("10");
    setAssigneeId("");
    setAuthorSeeksSembons(false);
    setIsRecurring(false);
    setRecurrenceKind("NONE");
    setWeekdays([1, 2, 3, 4, 5]);
    setDayOfMonth("15");
    setYearMonth("1");
    setYearDay("1");
    setActivateNow(false);
    setError("");
    setShowForm(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
    setPoints(String(task.points));
    setAssigneeId(task.assignee?.id ?? "");
    setAuthorSeeksSembons(task.authorSeeksSembons);
    setIsRecurring(task.isRecurring);
    setRecurrenceKind(task.recurrenceKind ?? "NONE");
    const p = task.recurrencePayload as { weekdays?: number[]; dayOfMonth?: number; month?: number; day?: number } | null;
    if (p?.weekdays) setWeekdays(p.weekdays);
    if (p?.dayOfMonth) setDayOfMonth(String(p.dayOfMonth));
    if (p?.month) setYearMonth(String(p.month));
    if (p?.day) setYearDay(String(p.day));
    setActivateNow(false);
    setError("");
    setShowForm(true);
  }

  async function handleComplete(taskId: string) {
    setCompleting(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, { method: "POST" });
      if (res.ok) {
        const updated = (await res.json()) as Task;
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: updated.status,
                  completedAt: updated.completedAt,
                  completer: updated.completer ?? t.completer,
                  nextDueAt: updated.nextDueAt ?? t.nextDueAt,
                  dueDate: updated.dueDate ?? t.dueDate,
                }
              : t
          )
        );
        router.refresh();
      }
    } finally {
      setCompleting(null);
    }
  }

  async function handleCopy(taskId: string) {
    const res = await fetch(`/api/tasks/${taskId}/copy`, { method: "POST" });
    if (res.ok) {
      const data = (await res.json()) as { id: string };
      router.push(`/tasks/${data.id}`);
      router.refresh();
    }
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    setLoading(true);
    try {
      const rk = isRecurring ? recurrenceKind : "NONE";
      const payload = {
        title,
        description: description || undefined,
        dueDate: dueDate || undefined,
        points: parseInt(points, 10) || 0,
        assigneeId: assigneeId || undefined,
        authorSeeksSembons,
        isRecurring,
        recurrenceKind: rk,
        recurrencePayload: buildRecurrencePayload(),
        ...(editing ? {} : { activateNow: activateNow && !authorSeeksSembons }),
      };
      const res = await fetch(editing ? `/api/tasks/${editing.id}` : "/api/tasks", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data.error as string) ?? "Ошибка");
        return;
      }
      if (editing) {
        setTasks((prev) => prev.map((t) => (t.id === editing.id ? { ...t, ...data } : t)));
      } else {
        setTasks((prev) => [data as Task, ...prev]);
      }
      router.refresh();
      setShowForm(false);
      setEditing(null);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-slate-900 dark:text-white text-2xl font-bold">Задачи и обязанности</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Создать
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-11 md:min-h-0"
        >
          <option value="">Все статусы</option>
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-11 md:min-h-0"
        >
          <option value="">Все исполнители</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.id}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-500">Нет задач</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => {
            const displayDue = task.nextDueAt ?? task.dueDate;
            const overdue =
              displayDue && task.status !== "DONE" && task.status !== "CANCELLED" && new Date(displayDue) < new Date();
            return (
              <div
                key={task.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-start gap-3 shadow-sm dark:shadow-none"
              >
                <div className={cn("mt-0.5 flex-shrink-0", STATUS_ICON_RING[task.status] ?? "text-slate-500")}>
                  {STATUS_ICONS[task.status] ?? <Circle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/tasks/${task.id}`} className="block min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium hover:text-indigo-600 dark:hover:text-indigo-400",
                          task.status === "DONE" ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-900 dark:text-white"
                        )}
                      >
                        {task.title}
                      </p>
                    </Link>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", STATUS_COLORS[task.status])}>
                        {STATUS_LABELS[task.status]}
                      </span>
                      <button
                        type="button"
                        title="Копировать в черновик"
                        onClick={() => void handleCopy(task.id)}
                        className="p-1 rounded text-slate-500 hover:text-indigo-500"
                      >
                        <ClipboardCopy className="w-3.5 h-3.5" />
                      </button>
                      {canEdit(task) && (
                        <button
                          type="button"
                          onClick={() => openEdit(task)}
                          className="p-1 rounded text-slate-500 hover:text-indigo-500"
                          title="Редактировать"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {task.description && (
                    <p className="text-slate-600 dark:text-slate-400 text-xs mt-1 line-clamp-2">{task.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-500">
                    {task.assignee && <span>Исполнитель: {task.assignee.name ?? task.assignee.id}</span>}
                    {!task.assigneeId && <span className="text-indigo-600 dark:text-indigo-400">Универсальная задача</span>}
                    {task.isRecurring && task.recurrenceKind !== "NONE" && (
                      <span className="text-purple-600 dark:text-purple-400">Регулярная</span>
                    )}
                    {displayDue && (
                      <span className={cn(overdue ? "text-red-400" : "")}>
                        {task.isRecurring ? "Ближайший срок: " : "До: "}
                        {format(new Date(displayDue), "d MMM yyyy", { locale: ru })}
                      </span>
                    )}
                    <span className="text-amber-700 dark:text-amber-400">+{task.points} семб.</span>
                  </div>
                </div>
                {canComplete(task) && (
                  <button
                    onClick={() => void handleComplete(task.id)}
                    disabled={completing === task.id}
                    className="flex-shrink-0 flex items-center gap-1.5 text-xs min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 bg-emerald-100 dark:bg-emerald-500/20 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {completing === task.id ? "…" : task.points > 0 ? "Выполнить" : "Готово"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md shadow-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-slate-900 dark:text-white font-semibold text-lg">{editing ? "Редактировать задачу" : "Новая задача"}</h2>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white min-h-11 min-w-11 flex items-center justify-center sm:min-h-0 sm:min-w-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Название *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Что нужно сделать?"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Описание</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Срок</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Сембоны (награда)</label>
                  <input
                    type="number"
                    min="0"
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={authorSeeksSembons} onChange={(e) => setAuthorSeeksSembons(e.target.checked)} className="rounded" />
                Постановщик хочет заработать сембоны (активация через админа)
              </label>
              {!editing && (
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activateNow}
                    onChange={(e) => setActivateNow(e.target.checked)}
                    disabled={authorSeeksSembons}
                    className="rounded"
                  />
                  Сразу в работу (если нет сембонов постановщику)
                </label>
              )}
              <div>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer mb-2">
                  <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="rounded" />
                  Регулярная задача (на экране — только ближайший срок)
                </label>
                {isRecurring && (
                  <div className="space-y-2 pl-1 border-l-2 border-indigo-200 dark:border-indigo-900/50">
                    <select
                      value={recurrenceKind}
                      onChange={(e) => setRecurrenceKind(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="DAILY">Ежедневно</option>
                      <option value="WEEKLY">По дням недели</option>
                      <option value="MONTHLY">По дням месяца</option>
                      <option value="YEARLY">По дням года</option>
                    </select>
                    {recurrenceKind === "WEEKLY" && (
                      <div className="flex flex-wrap gap-1">
                        {WEEKDAYS.map(({ v, l }) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => toggleWeekday(v)}
                            className={cn(
                              "text-xs px-2 py-1 rounded border",
                              weekdays.includes(v)
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "border-slate-300 dark:border-slate-600"
                            )}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    )}
                    {recurrenceKind === "MONTHLY" && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-600">Число месяца</span>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={dayOfMonth}
                          onChange={(e) => setDayOfMonth(e.target.value)}
                          className="w-20 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1"
                        />
                      </div>
                    )}
                    {recurrenceKind === "YEARLY" && (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-slate-600">Месяц</span>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={yearMonth}
                          onChange={(e) => setYearMonth(e.target.value)}
                          className="w-16 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1"
                        />
                        <span className="text-slate-600">День</span>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={yearDay}
                          onChange={(e) => setYearDay(e.target.value)}
                          className="w-16 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Исполнитель</label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Не назначен (универсальная)</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name ?? u.id}
                    </option>
                  ))}
                </select>
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-600 dark:text-red-400 text-sm">{error}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditing(null);
                  }}
                  className="flex-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 font-medium rounded-lg px-4 py-2.5 transition-colors text-sm min-h-11 sm:min-h-0"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-4 py-2.5 transition-colors text-sm",
                    loading && "opacity-60 cursor-not-allowed"
                  )}
                >
                  {loading ? "Сохранение…" : editing ? "Сохранить" : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
