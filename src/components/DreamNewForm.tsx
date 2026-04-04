"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type UserOpt = { id: string; name: string | null; isServiceUser: boolean };

type Row = { supporterId: string; requestedSembons: string };

export default function DreamNewForm() {
  const router = useRouter();
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [shortTitle, setShortTitle] = useState("");
  const [bodyRich, setBodyRich] = useState("");
  const [publishNow, setPublishNow] = useState(false);
  const [rows, setRows] = useState<Row[]>([{ supporterId: "", requestedSembons: "10" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/users");
      if (res.ok) {
        const list = (await res.json()) as UserOpt[];
        setUsers(list.filter((u) => !u.isServiceUser));
      }
    })();
  }, []);

  function addRow() {
    setRows((r) => [...r, { supporterId: "", requestedSembons: "10" }]);
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supports = rows
        .filter((r) => r.supporterId)
        .map((r) => ({
          supporterId: r.supporterId,
          requestedSembons: parseInt(r.requestedSembons, 10) || 1,
        }));
      const res = await fetch("/api/dreams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shortTitle,
          bodyRich,
          status: publishNow ? "ACTIVE" : "DRAFTING",
          supports,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data.error as string) ?? "Ошибка");
        return;
      }
      router.push(`/dreams/${(data as { id: string }).id}`);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-slate-900 dark:text-white text-2xl font-bold">Новая мечта</h1>
        <Link href="/dreams" className="text-sm text-indigo-600 dark:text-indigo-400">
          К списку
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Кратко *</label>
          <input
            value={shortTitle}
            onChange={(e) => setShortTitle(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Мечта (текст)</label>
          <textarea
            value={bodyRich}
            onChange={(e) => setBodyRich(e.target.value)}
            rows={8}
            placeholder="Опишите мечту. Можно вставлять ссылки; расширенный редактор — позже."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm resize-y min-h-[160px]"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Поддержка (сембоны)</span>
            <button type="button" onClick={addRow} className="text-xs text-indigo-600 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Добавить
            </button>
          </div>
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={row.supporterId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRows((r) => r.map((x, j) => (j === i ? { ...x, supporterId: v } : x)));
                  }}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-sm"
                >
                  <option value="">Кого просим</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name ?? u.id}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={row.requestedSembons}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRows((r) => r.map((x, j) => (j === i ? { ...x, requestedSembons: v } : x)));
                  }}
                  className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-sm"
                />
                <span className="text-xs text-slate-500">семб.</span>
                {rows.length > 1 && (
                  <button type="button" onClick={() => removeRow(i)} className="p-1 text-slate-500 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
          Сразу активировать (отправить уведомления тем, кого выбрали)
        </label>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={cn(
            "w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500",
            loading && "opacity-60"
          )}
        >
          {loading ? "Сохранение…" : "Создать мечту"}
        </button>
      </form>
    </div>
  );
}
