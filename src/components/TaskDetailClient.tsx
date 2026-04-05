"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  Loader2,
  Shield,
  Send,
  Play,
  Gavel,
  ThumbsUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

type User = { id: string; name: string | null };
type TaskDetail = {
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

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Черновик",
  APPROVAL_PENDING: "Согласование",
  IN_PROGRESS: "В работе",
  IN_REVIEW: "Приёмка",
  DONE: "Сделана",
  POSTPONED: "Отложена",
  CANCELLED: "Отменена",
};

const REC_LABEL: Record<string, string> = {
  NONE: "—",
  DAILY: "Ежедневно",
  WEEKLY: "По дням недели",
  MONTHLY: "По дням месяца",
  YEARLY: "По дням года",
};

export default function TaskDetailClient({
  task: initial,
  currentUserId,
  currentUserRole,
}: {
  task: TaskDetail;
  currentUserId: string;
  currentUserRole: string;
}) {
  const router = useRouter();
  const [task, setTask] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const isAdmin = currentUserRole === "ADMIN" || currentUserRole === "SUPERADMIN";
  const isAuthor = task.authorId === currentUserId;

  async function runAction(action: string) {
    setLoading(action);
    setErr("");
    try {
      const res = await fetch(`/api/tasks/${task.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr((data.error as string) ?? "Ошибка");
        return;
      }
      setTask(data as TaskDetail);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function runComplete() {
    setLoading("complete");
    setErr("");
    try {
      const res = await fetch(`/api/tasks/${task.id}/complete`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErr((data.error as string) ?? "Ошибка");
        return;
      }
      setTask(data as TaskDetail);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function patchStatus(status: "POSTPONED" | "CANCELLED") {
    setLoading(status);
    setErr("");
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr((data.error as string) ?? "Ошибка");
        return;
      }
      setTask(data as TaskDetail);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function runCopy() {
    setLoading("copy");
    setErr("");
    try {
      const res = await fetch(`/api/tasks/${task.id}/copy`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErr((data.error as string) ?? "Ошибка");
        return;
      }
      router.push(`/tasks/${(data as { id: string }).id}`);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  const canComplete =
    task.status === "IN_PROGRESS" &&
    (isAdmin || task.assigneeId === currentUserId || task.assigneeId == null);

  const due = task.nextDueAt ?? task.dueDate;
  const overdue = due && task.status !== "DONE" && task.status !== "CANCELLED" && new Date(due) < new Date();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/tasks"
          className="text-indigo-600 dark:text-indigo-400 text-sm flex items-center gap-1 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> К списку задач
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                task.status === "DONE"
                  ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400"
                  : task.status === "IN_PROGRESS"
                    ? "bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-300"
              )}
            >
              {STATUS_LABEL[task.status] ?? task.status}
            </span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-2">{task.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runCopy()}
              disabled={loading !== null}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {loading === "copy" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
              Копировать в черновик
            </button>
          </div>
        </div>

        {task.description && (
          <p className="text-slate-600 dark:text-slate-400 text-sm whitespace-pre-wrap">{task.description}</p>
        )}

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500 text-xs">Постановщик</dt>
            <dd className="text-slate-900 dark:text-white">{task.author?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Исполнитель</dt>
            <dd className="text-slate-900 dark:text-white">
              {task.assignee ? task.assignee.name : <span className="text-indigo-600 dark:text-indigo-400">Не назначен (видна всем)</span>}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Сембоны (награда)</dt>
            <dd className="text-amber-700 dark:text-amber-400">+{task.points}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Сембоны постановщику</dt>
            <dd className="text-slate-900 dark:text-white">{task.authorSeeksSembons ? "Да (нужно согласование)" : "Нет"}</dd>
          </div>
          {task.isRecurring && task.recurrenceKind !== "NONE" && (
            <div className="sm:col-span-2">
              <dt className="text-slate-500 text-xs">Регулярная</dt>
              <dd className="text-slate-900 dark:text-white">
                {REC_LABEL[task.recurrenceKind] ?? task.recurrenceKind}
                {task.recurrencePayload != null && (
                  <span className="text-slate-500 text-xs ml-2 font-mono">{JSON.stringify(task.recurrencePayload)}</span>
                )}
              </dd>
            </div>
          )}
          {due && (
            <div>
              <dt className="text-slate-500 text-xs">{task.isRecurring ? "Ближайший срок" : "Срок"}</dt>
              <dd className={cn(overdue && "text-red-500")}>
                {format(new Date(due), "d MMMM yyyy", { locale: ru })}
              </dd>
            </div>
          )}
        </dl>

        {err && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {task.status === "POSTPONED" && (isAuthor || isAdmin) && (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void runAction("resume")}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Вернуть в черновик
            </button>
          )}

          {task.status === "DRAFT" && (isAuthor || isAdmin) && (
            <>
              {!task.authorSeeksSembons && (
                <button
                  type="button"
                  disabled={loading !== null}
                  onClick={() => void runAction("activate")}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {loading === "activate" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  В работу
                </button>
              )}
              {task.authorSeeksSembons && (
                <button
                  type="button"
                  disabled={loading !== null}
                  onClick={() => void runAction("submitApproval")}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  {loading === "submitApproval" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  На согласование админу
                </button>
              )}
            </>
          )}

          {task.status === "APPROVAL_PENDING" && isAdmin && (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void runAction("approveActivation")}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading === "approveActivation" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gavel className="w-3.5 h-3.5" />}
              Согласовать активацию
            </button>
          )}

          {task.status === "IN_REVIEW" && isAdmin && (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void runAction("approveCompletion")}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading === "approveCompletion" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
              Принять выполнение
            </button>
          )}

          {canComplete && (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void runComplete()}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 disabled:opacity-50"
            >
              {loading === "complete" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {task.points > 0 ? "Сообщить о выполнении" : "Выполнить"}
            </button>
          )}

          {(isAuthor || isAdmin) &&
            ["DRAFT", "IN_PROGRESS", "APPROVAL_PENDING"].includes(task.status) && (
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void patchStatus("POSTPONED")}
                className="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Отложить
              </button>
            )}
          {(isAuthor || isAdmin) && task.status !== "DONE" && task.status !== "CANCELLED" && (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void patchStatus("CANCELLED")}
              className="text-xs px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              Отменить
            </button>
          )}

          {isAdmin && task.status !== "DONE" && task.status !== "CANCELLED" && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Shield className="w-3.5 h-3.5" /> Админ
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Редактирование полей — в{" "}
        <Link href="/tasks" className="text-indigo-600 dark:text-indigo-400 underline">
          общем списке задач
        </Link>{" "}
        (карандаш у задачи).
      </p>
    </div>
  );
}
