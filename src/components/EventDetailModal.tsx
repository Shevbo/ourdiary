"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS, cn } from "@/lib/utils";

type CommentRow = {
  id: string;
  text: string;
  createdAt: string;
  author: { id: string; name: string | null; avatarUrl: string | null };
};

type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  date: string;
  imageUrl: string | null;
  author: { id: string; name: string | null; avatarUrl: string | null };
  links: { id: string; label: string; url: string }[];
  comments: CommentRow[];
  reactions: { emoji: string; userId: string }[];
};

const QUICK_EMOJI = ["👍", "❤️", "😂", "😮", "🎉"];

function packReactions(rows: { emoji: string; userId: string }[], uid: string) {
  const map = new Map<string, { emoji: string; count: number; me: boolean }>();
  for (const r of rows) {
    const cur = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, me: false };
    cur.count += 1;
    if (r.userId === uid) cur.me = true;
    map.set(r.emoji, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export default function EventDetailModal({
  eventId,
  currentUserId,
  onClose,
}: {
  eventId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [reactions, setReactions] = useState<{ emoji: string; count: number; me: boolean }[]>([]);
  const [reacting, setReacting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/events/${eventId}`);
        if (!res.ok) return;
        const data = (await res.json()) as EventDetail;
        if (cancelled) return;
        setEvent(data);
        setReactions(packReactions(data.reactions ?? [], currentUserId));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, currentUserId]);

  async function sendComment() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/events/${eventId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      if (!res.ok) return;
      const c = (await res.json()) as CommentRow;
      setEvent((prev) => (prev ? { ...prev, comments: [...prev.comments, c] } : prev));
      setText("");
    } finally {
      setSending(false);
    }
  }

  async function toggleEmoji(emoji: string) {
    if (reacting) return;
    setReacting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) return;
      const fresh = await fetch(`/api/events/${eventId}`);
      if (!fresh.ok) return;
      const data = (await fresh.json()) as EventDetail;
      setReactions(packReactions(data.reactions ?? [], currentUserId));
    } finally {
      setReacting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Закрыть" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-slate-900 dark:text-white font-semibold text-sm truncate pr-2">
            {loading ? "…" : event?.title ?? "Событие"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {loading && <p className="text-slate-500 text-sm">Загрузка…</p>}
          {!loading && event && (
            <>
              {event.imageUrl && (
                <div className="rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={event.imageUrl} alt="" className="w-full max-h-56 object-contain" />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", EVENT_TYPE_COLORS[event.type])}>
                  {EVENT_TYPE_LABELS[event.type]}
                </span>
                <span className="text-xs text-slate-500">
                  {format(new Date(event.date), "d MMMM yyyy, HH:mm", { locale: ru })}
                </span>
              </div>
              <p className="text-slate-900 dark:text-white font-medium">{event.title}</p>
              {event.description && (
                <p className="text-slate-600 dark:text-slate-400 text-sm whitespace-pre-wrap">{event.description}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_EMOJI.map((e) => {
                  const row = reactions.find((r) => r.emoji === e);
                  return (
                    <button
                      key={e}
                      type="button"
                      disabled={reacting}
                      onClick={() => void toggleEmoji(e)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm border transition-colors",
                        row?.me
                          ? "border-indigo-500 bg-indigo-500/15 text-indigo-200"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                    >
                      <span>{e}</span>
                      {row && row.count > 0 && <span className="text-xs text-slate-500">{row.count}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Комментарии</p>
                {event.comments.length === 0 ? (
                  <p className="text-sm text-slate-500">Пока нет комментариев</p>
                ) : (
                  event.comments.map((c) => (
                    <div key={c.id} className="rounded-lg bg-slate-50 dark:bg-slate-800/80 p-3 text-sm">
                      <p className="text-xs text-slate-500 mb-1">{c.author.name ?? "Участник"}</p>
                      <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{c.text}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 p-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Комментарий…"
            className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendComment();
              }
            }}
          />
          <button
            type="button"
            disabled={sending || !text.trim()}
            onClick={() => void sendComment()}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
}
