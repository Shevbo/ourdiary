"use client";

import { useEffect, useState } from "react";
import { Tags, Plus, Trash2, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type CatRow = {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

export default function AdminExpenseCategoriesSection() {
  const router = useRouter();
  const [rows, setRows] = useState<CatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [editing, setEditing] = useState<CatRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/admin/expense-categories");
    if (!res.ok) return;
    const j = (await res.json()) as { categories: CatRow[] };
    setRows(j.categories);
  }

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/expense-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          label: label.trim(),
          sortOrder: parseInt(sortOrder, 10) || 0,
          isActive: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError((d.error as string) ?? "Ошибка");
        return;
      }
      setCode("");
      setLabel("");
      setSortOrder("0");
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/expense-categories/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          sortOrder: parseInt(sortOrder, 10) || 0,
          isActive: editing.isActive,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError((d.error as string) ?? "Ошибка");
        return;
      }
      setEditing(null);
      setCode("");
      setLabel("");
      setSortOrder("0");
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(c: CatRow) {
    const res = await fetch(`/api/admin/expense-categories/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    if (res.ok) {
      await load();
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (!confirm("Удалить категорию? (только если нет расходов с этим кодом)")) return;
    const res = await fetch(`/api/admin/expense-categories/${id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((d as { error?: string }).error ?? "Ошибка");
      return;
    }
    await load();
    router.refresh();
  }

  function openEdit(c: CatRow) {
    setEditing(c);
    setCode(c.code);
    setLabel(c.label);
    setSortOrder(String(c.sortOrder));
    setError("");
  }

  return (
    <section className="mt-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Tags className="w-5 h-5 text-emerald-500" />
        <h2 className="text-slate-900 dark:text-white font-semibold text-lg">Категории расходов</h2>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        Код — латиница в верхнем регистре (например FOOD). Отключённые категории не показываются в формах.
      </p>

      {!editing ? (
        <form onSubmit={handleCreate} className="mb-6 grid gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2 grid gap-2 sm:grid-cols-3">
            <div>
              <label className="text-xs text-slate-500">Код</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="FOOD"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Название</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Продукты"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Порядок</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy || !code.trim() || !label.trim()}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white",
                busy && "opacity-60"
              )}
            >
              <Plus className="w-4 h-4" />
              Добавить категорию
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={saveEdit} className="mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-600">{editing.code}</span>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setCode("");
                setLabel("");
                setSortOrder("0");
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white">
            Сохранить
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Загрузка…</p>
      ) : (
        <ul className="space-y-1 max-h-[280px] overflow-y-auto text-sm">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2"
            >
              <span className="font-mono text-xs text-slate-500 w-28 shrink-0">{c.code}</span>
              <span className="flex-1 truncate">{c.label}</span>
              <span className="text-xs text-slate-400">{c.sortOrder}</span>
              <span className={cn("text-xs", c.isActive ? "text-emerald-600" : "text-slate-400")}>
                {c.isActive ? "on" : "off"}
              </span>
              <button type="button" onClick={() => void toggleActive(c)} className="text-xs text-indigo-600">
                {c.isActive ? "Выкл" : "Вкл"}
              </button>
              <button type="button" onClick={() => openEdit(c)}>
                <Pencil className="w-4 h-4 text-slate-500" />
              </button>
              <button type="button" onClick={() => void remove(c.id)}>
                <Trash2 className="w-4 h-4 text-slate-500 hover:text-red-500" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
