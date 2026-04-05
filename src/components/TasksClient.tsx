"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
  Pencil,
  ClipboardCopy,
  FileEdit,
  Send,
  Hourglass,
  Gavel,
} from "lucide-react";
import SembonIcon from "@/components/SembonIcon";
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
  seriesEndsAt: string | null;
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
  OVERDUE: "Просрочена",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-200 dark:bg-slate-500/20 text-slate-700 dark:text-slate-400",
  APPROVAL_PENDING: "bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-400",
  IN_PROGRESS: "bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400",
  IN_REVIEW: "bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-400",
  DONE: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400",
  POSTPONED: "bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-400",
  CANCELLED: "bg-slate-300 dark:bg-slate-600/30 text-slate-600 dark:text-slate-500",
  OVERDUE: "bg-red-100 dark:bg-red-500/20 text-red-900 dark:text-red-400",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  DRAFT: <FileEdit className="w-4 h-4" />,
  APPROVAL_PENDING: <Send className="w-4 h-4" />,
  IN_PROGRESS: <Clock className="w-4 h-4" />,
  IN_REVIEW: <Gavel className="w-4 h-4" />,
  DONE: <CheckCircle2 className="w-4 h-4" />,
  POSTPONED: <Hourglass className="w-4 h-4" />,
  CANCELLED: <AlertCircle className="w-4 h-4" />,
  OVERDUE: <AlertCircle className="w-4 h-4" />,
};

const STATUS_ICON_RING: Record<string, string> = {
  DRAFT: "text-slate-500 dark:text-slate-400",
  APPROVAL_PENDING: "text-amber-600 dark:text-amber-400",
  IN_PROGRESS: "text-blue-600 dark:text-blue-400",
  IN_REVIEW: "text-violet-600 dark:text-violet-400",
  DONE: "text-emerald-600 dark:text-emerald-400",
  POSTPONED: "text-orange-600 dark:text-orange-400",
  CANCELLED: "text-slate-500",
  OVERDUE: "text-red-600 dark:text-red-400",
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

function toDatetimeLocal(iso: string | null | undefined) {
  if (!iso) return "";
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
}

function fromDatetimeLocal(s: string) {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

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
  const [dueDatetime, setDueDatetime] = useState("");
  const [seriesEndsAt, setSeriesEndsAt] = useState("");
  const [formStatus, setFormStatus] = useState("DRAFT");
  const [points, setPoints] = useState("0");
  const [assigneeId, setAssigneeId] = useState("");
  const [showSembonsModal, setShowSembonsModal] = useState(false);
  const [sembonsModalInput, setSembonsModalInput] = useState("0");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceKind, setRecurrenceKind] = useState("NONE");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [dayOfMonth, setDayOfMonth] = useState("15");
  const [yearMonth, setYearMonth] = useState("1");
  const [yearDay, setYearDay] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    let list = tasks;
    if (filterStatus) list = list.filter((t) => t.status === filterStatus);
    if (filterAssignee) list = list.filter((t) => t.assignee?.id === filterAssignee);
    return list;
  }, [tasks, filterStatus, filterAssignee]);

  function canComplete(task: Task) {
    if (task.status !== "IN_PROGRESS" && task.status !== "OVERDUE") return false;
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
    setDueDatetime("");
    setSeriesEndsAt("");
    setFormStatus("DRAFT");
    setPoints("0");
    setAssigneeId("");
    setIsRecurring(false);
    setRecurrenceKind("NONE");
    setWeekdays([1, 2, 3, 4, 5]);
    setDayOfMonth("15");
    setYearMonth("1");
    setYearDay("1");
    setShowSembonsModal(false);
    setError("");
    setShowForm(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setDueDatetime(toDatetimeLocal(task.dueDate));
    setSeriesEndsAt(task.seriesEndsAt ? task.seriesEndsAt.slice(0, 10) : "");
    setFormStatus(
      ["DRAFT", "IN_PROGRESS", "APPROVAL_PENDING", "POSTPONED", "CANCELLED"].includes(task.status)
        ? task.status
        : "DRAFT"
    );
    setPoints(String(task.points));
    setAssigneeId(task.assignee?.id ?? "");
    setIsRecurring(task.isRecurring);
    setRecurrenceKind(task.recurrenceKind ?? "NONE");
    const p = task.recurrencePayload as { weekdays?: number[]; dayOfMonth?: number; month?: number; day?: number } | null;
    if (p?.weekdays) setWeekdays(p.weekdays);
    if (p?.dayOfMonth) setDayOfMonth(String(p.dayOfMonth));
    if (p?.month) setYearMonth(String(p.month));
    if (p?.day) setYearDay(String(p.day));
    setShowSembonsModal(false);
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
      const payload: Record<string, unknown> = {
        title,
        description: description || undefined,
        points: parseInt(points, 10) || 0,
        assigneeId: assigneeId || undefined,
        isRecurring,
        recurrenceKind: rk,
        recurrencePayload: buildRecurrencePayload(),
        status: formStatus,
      };
      if (isRecurring && rk !== "NONE") {
        payload.seriesEndsAt = seriesEndsAt || undefined;
        payload.dueDate = fromDatetimeLocal(dueDatetime);
      } else {
        payload.dueDate = fromDatetimeLocal(dueDatetime);
        payload.seriesEndsAt = undefined;
      }
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
              task.status === "OVERDUE" ||
              (displayDue &&
                task.status !== "DONE" &&
                task.status !== "CANCELLED" &&
                new Date(displayDue) < new Date());
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
                        {format(new Date(displayDue), "d MMM yyyy HH:mm", { locale: ru })}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                      <SembonIcon className="h-3.5 w-3.5" />
                      +{task.points} семб.
                    </span>
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
        <>
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
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Статус</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="DRAFT">Черновик</option>
                  <option value="APPROVAL_PENDING">Согласование</option>
                  <option value="IN_PROGRESS">В работе</option>
                  <option value="POSTPONED">Отложена</option>
                  <option value="CANCELLED">Отменена</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSembonsModalInput(points);
                    setShowSembonsModal(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 text-sm font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                >
                  <SembonIcon className="h-4 w-4" title="Сембоны" />
                  Сембоны
                </button>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {(parseInt(points, 10) || 0) > 0 ? (
                    <>Награда за выполнение: <span className="font-medium text-amber-700 dark:text-amber-400">{points} семб.</span></>
                  ) : (
                    <span className="text-slate-500">Без сембонов — при выполнении без приёмки у админа</span>
                  )}
                </p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setIsRecurring(on);
                      if (on && recurrenceKind === "NONE") setRecurrenceKind("DAILY");
                    }}
                    className="rounded"
                  />
                  Регулярная задача (на экране — только ближайший срок)
                </label>
                {isRecurring && (
                  <div className="space-y-2 pl-1 border-l-2 border-indigo-200 dark:border-indigo-900/50">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 text-xs mb-1">Ближайший срок (дата и время)</label>
                      <input
                        type="datetime-local"
                        value={dueDatetime}
                        onChange={(e) => setDueDatetime(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
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
              {isRecurring && recurrenceKind !== "NONE" ? (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">
                    Дата окончания серии задач
                  </label>
                  <input
                    type="date"
                    value={seriesEndsAt}
                    onChange={(e) => setSeriesEndsAt(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Опционально — после этой даты новые экземпляры не планируются.</p>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Срок (дата и время)</label>
                  <input
                    type="datetime-local"
                    value={dueDatetime}
                    onChange={(e) => setDueDatetime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
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

        {showSembonsModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="sembons-dialog-title"
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4"
            >
              <h3
                id="sembons-dialog-title"
                className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white"
              >
                <SembonIcon className="h-6 w-6" title="Сембоны" />
                Задача за сембоны
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Сколько, на твой взгляд, сембонов перевести тебе на счёт за выполнение этой задачи (каждого экземпляра задачи, если она регулярная)?
              </p>
              <input
                type="number"
                min={0}
                max={9999}
                value={sembonsModalInput}
                onChange={(e) => setSembonsModalInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white"
              />
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSembonsModal(false)}
                  className="flex-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 font-medium rounded-lg px-4 py-2.5 text-sm"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const n = Math.max(0, Math.min(9999, parseInt(sembonsModalInput, 10) || 0));
                    setPoints(String(n));
                    setShowSembonsModal(false);
                  }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-4 py-2.5 text-sm"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}
