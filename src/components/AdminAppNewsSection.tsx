"use client";

import { useEffect, useState } from "react";
import { Newspaper, Plus, Trash2, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type NewsRow = { id: string; body: string; createdAt: string; published: boolean };

export default function AdminAppNewsSection() {
  const router = useRouter();
  const [items, setItems] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<NewsRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/admin/app-news");
    if (!res.ok) return;
    const j = (await res.json()) as { items: NewsRow[] };
    setItems(j.items);
  }

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const t = body.trim();
    if (!t) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/app-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: t, published: true }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError((d.error as string) ?? "Ошибка");
        return;
      }
      setBody("");
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!editing) return;
    const t = body.trim();
    if (!t) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/app-news/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: t, published: editing.published }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError((d.error as string) ?? "Ошибка");
        return;
      }
      setEditing(null);
      setBody("");
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished(n: NewsRow) {
    const res = await fetch(`/api/app-news/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !n.published }),
    });
    if (res.ok) {
      await load();
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (!confirm("Удалить новость из ленты?")) return;
    const res = await fetch(`/api/app-news/${id}`, { method: "DELETE" });
    if (res.ok) {
      await load();
      router.refresh();
    }
  }

  function openEdit(n: NewsRow) {
    setEditing(n);
    setBody(n.body);
    setError("");
  }

  return (
    <section className="mt-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Newspaper className="w-5 h-5 text-indigo-500" />
        <h2 className="text-slate-900 dark:text-white font-semibold text-lg">Новости ленты «Что нового»</h2>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        Автоимпорт из файла на сервере:{" "}
        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">npm run sync-app-news</code> (см.{" "}
        <code className="text-xs">src/content/app-news-latest.md</code>).
      </p>

      {!editing ? (
        <form onSubmit={handleCreate} className="mb-6 space-y-2">
          <label className="block text-xs text-slate-500">Новая запись (задорно, по делу)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Что мы тут запилили…"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !body.trim()}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white",
              busy && "opacity-60"
            )}
          >
            <Plus className="w-4 h-4" />
            Добавить в ленту
          </button>
        </form>
      ) : (
        <form onSubmit={handleSaveEdit} className="mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-500">Редактирование</label>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setBody("");
              }}
              className="text-slate-500 hover:text-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">
            Сохранить
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Загрузка…</p>
      ) : (
        <ul className="space-y-2 max-h-[320px] overflow-y-auto">
          {items.map((n) => (
            <li
              key={n.id}
              className="flex items-start gap-2 rounded-lg border border-slate-100 dark:border-slate-800 p-3 text-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 mb-1">
                  {new Date(n.createdAt).toLocaleString("ru-RU")} · {n.published ? "в ленте" : "скрыта"}
                </p>
                <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{n.body}</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button type="button" onClick={() => void togglePublished(n)} className="text-xs text-indigo-600">
                  {n.published ? "Скрыть" : "Показать"}
                </button>
                <button type="button" onClick={() => openEdit(n)} className="text-slate-500 hover:text-indigo-500">
                  <Pencil className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => void remove(n.id)} className="text-slate-500 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
