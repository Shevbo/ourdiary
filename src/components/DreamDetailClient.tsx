"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DarumaIcon, DREAM_STATUS_LABEL } from "./DarumaStatus";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Support = {
  id: string;
  requestedSembons: number;
  agreedSembons: number | null;
  responseStatus: string;
  supporter: { id: string; name: string | null };
};

type Dream = {
  id: string;
  orderNo: number;
  shortTitle: string;
  bodyRich: string;
  status: string;
  lockedAt: string | null;
  authorId: string;
  author: { id: string; name: string | null };
  supports: Support[];
};

type UserOpt = { id: string; name: string | null };

export default function DreamDetailClient({ dreamId }: { dreamId: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [dream, setDream] = useState<Dream | null>(null);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [shortTitle, setShortTitle] = useState("");
  const [bodyRich, setBodyRich] = useState("");
  const [status, setStatus] = useState("");
  const [newSupporter, setNewSupporter] = useState("");
  const [newAmount, setNewAmount] = useState("10");
  const [agreeInputs, setAgreeInputs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/dreams/${dreamId}`);
    if (!res.ok) {
      setError("Не удалось загрузить");
      setDream(null);
      return;
    }
    const d = (await res.json()) as Dream;
    setDream(d);
    setShortTitle(d.shortTitle);
    setBodyRich(d.bodyRich);
    setStatus(d.status);
    const ai: Record<string, string> = {};
    for (const s of d.supports) {
      ai[s.id] = String(s.requestedSembons);
    }
    setAgreeInputs(ai);
  }, [dreamId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      const u = await fetch("/api/users");
      if (u.ok) {
        const list = (await u.json()) as UserOpt[];
        setUsers(list);
      }
      setLoading(false);
    })();
  }, [load]);

  const role = session?.user?.role ?? "";
  const uid = session?.user?.id;
  const isSuper = role === "SUPERADMIN";
  const locked = dream?.lockedAt != null;
  const isAuthor = dream?.authorId === uid;
  const canEdit = dream && (isSuper || (isAuthor && !locked));

  async function saveDream(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/dreams/${dreamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortTitle, bodyRich, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data.error as string) ?? "Ошибка");
        return;
      }
      setDream(data as Dream);
    } finally {
      setSaving(false);
    }
  }

  async function addSupport() {
    if (!newSupporter || !dream) return;
    const res = await fetch(`/api/dreams/${dreamId}/supports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supporterId: newSupporter,
        requestedSembons: parseInt(newAmount, 10) || 1,
      }),
    });
    if (res.ok) {
      setNewSupporter("");
      await load();
    } else {
      const d = await res.json();
      setError(d.error ?? "Ошибка");
    }
  }

  async function removeSupport(sid: string) {
    if (!confirm("Удалить строку поддержки?")) return;
    const res = await fetch(`/api/dreams/${dreamId}/supports/${sid}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  async function respond(sid: string, action: "agree" | "decline") {
    const body =
      action === "agree"
        ? { action: "agree", agreedSembons: parseInt(agreeInputs[sid] ?? "1", 10) }
        : { action: "decline" };
    const res = await fetch(`/api/dreams/${dreamId}/supports/${sid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) await load();
    else {
      const d = await res.json();
      setError(d.error ?? "Ошибка");
    }
  }

  async function deleteDream() {
    if (!confirm("Удалить мечту?")) return;
    const res = await fetch(`/api/dreams/${dreamId}`, { method: "DELETE" });
    if (res.ok) router.push("/dreams");
  }

  if (loading || !dream) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        {error ? <p className="text-red-600">{error}</p> : <p className="text-slate-500">Загрузка…</p>}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <Link href="/dreams" className="text-sm text-indigo-600 dark:text-indigo-400">
          ← Все мечты
        </Link>
        {(isAuthor || isSuper) && (
          <button type="button" onClick={() => void deleteDream()} className="text-sm text-red-600">
            Удалить
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <DarumaIcon status={dream.status} />
        <div>
          <p className="text-xs text-slate-500">№ {dream.orderNo}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {DREAM_STATUS_LABEL[dream.status]} {locked && "· зафиксирована"}
          </p>
        </div>
      </div>

      {canEdit ? (
        <form onSubmit={saveDream} className="space-y-3 mb-8">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Заголовок</label>
            <input
              value={shortTitle}
              onChange={(e) => setShortTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Текст</label>
            <textarea
              value={bodyRich}
              onChange={(e) => setBodyRich(e.target.value)}
              rows={10}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Статус</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {Object.entries(DREAM_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className={cn("rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white", saving && "opacity-60")}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </form>
      ) : (
        <div className="mb-8">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{dream.shortTitle}</h1>
          <pre className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 text-sm font-sans">{dream.bodyRich}</pre>
        </div>
      )}

      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Поддержка</h2>
      <ul className="space-y-3 mb-6">
        {dream.supports.map((s) => {
          const mine = s.supporter.id === uid;
          const pending = s.responseStatus === "PENDING";
          return (
            <li
              key={s.id}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-900 dark:text-white">{s.supporter.name ?? s.supporter.id}</span>
                <span className="text-xs text-slate-500">
                  просят {s.requestedSembons} семб.
                  {s.responseStatus === "AGREED" && s.agreedSembons != null && (
                    <> → согласовано {s.agreedSembons}</>
                  )}
                  {s.responseStatus === "DECLINED" && " → отклонено"}
                </span>
              </div>
              {mine && pending && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={agreeInputs[s.id] ?? ""}
                    onChange={(e) =>
                      setAgreeInputs((m) => ({ ...m, [s.id]: e.target.value }))
                    }
                    className="w-24 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void respond(s.id, "agree")}
                    className="rounded bg-emerald-600 px-3 py-1 text-xs text-white"
                  >
                    Согласовать
                  </button>
                  <button
                    type="button"
                    onClick={() => void respond(s.id, "decline")}
                    className="rounded border border-slate-300 px-3 py-1 text-xs"
                  >
                    Отказаться
                  </button>
                </div>
              )}
              {isAuthor && !locked && (
                <button
                  type="button"
                  onClick={() => void removeSupport(s.id)}
                  className="mt-2 text-xs text-red-600 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Удалить строку
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {isAuthor && !locked && (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Добавить поддержку</p>
          <div className="flex flex-wrap gap-2">
            <select
              value={newSupporter}
              onChange={(e) => setNewSupporter(e.target.value)}
              className="flex-1 min-w-[160px] rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-2 text-sm"
            >
              <option value="">Участник</option>
              {users
                .filter((u) => u.id !== dream.authorId)
                .map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.id}</option>
                ))}
            </select>
            <input
              type="number"
              min={1}
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void addSupport()}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-200 dark:bg-slate-700 px-3 py-2 text-sm"
            >
              <Plus className="w-4 h-4" /> Добавить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
