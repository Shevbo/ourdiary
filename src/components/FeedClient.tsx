"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import EventCard, { type EventCardData } from "./EventCard";
import AddEventModal from "./AddEventModal";
import EventDetailModal from "./EventDetailModal";
import { useRouter } from "next/navigation";

export default function FeedClient({
  appNews,
  events: initialEvents,
  currentUserId,
  currentUserRole,
}: {
  appNews: { id: string; body: string; createdAt: string }[];
  events: EventCardData[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EventCardData | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [commentEventId, setCommentEventId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  useEffect(() => {
    if (commentEventId && commentInputRef.current) {
      commentInputRef.current.focus();
    }
  }, [commentEventId]);

  function mergeSavedEvent(saved: EventCardData) {
    setEvents((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id);
      if (idx === -1) return [saved, ...prev];
      const next = [...prev];
      next[idx] = saved;
      return next;
    });
    router.refresh();
  }

  function handleDelete(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    router.refresh();
  }

  async function submitComment() {
    const t = commentText.trim();
    if (!t || !commentEventId || sendingComment) return;
    setSendingComment(true);
    try {
      const res = await fetch(`/api/events/${commentEventId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      if (res.ok) {
        setCommentText("");
        setCommentEventId(null);
        router.refresh();
      }
    } finally {
      setSendingComment(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {appNews.length > 0 && (
        <section className="mb-8 rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 to-violet-50/80 p-4 shadow-sm dark:border-indigo-900/50 dark:from-indigo-950/40 dark:to-slate-900/80">
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400 shrink-0" />
              <h2 className="text-slate-900 dark:text-white font-bold text-lg">Что нового в приложении</h2>
            </div>
            <p className="text-sm text-indigo-600 dark:text-indigo-300 mt-1 pl-7">Что мы тут запилили 😊</p>
          </div>
          <div className="space-y-4">
            {appNews.map((n) => (
              <article
                key={n.id}
                className="rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700 px-4 py-3 text-slate-800 dark:text-slate-200 text-sm leading-relaxed"
              >
                <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                  {format(new Date(n.createdAt), "d MMMM yyyy", { locale: ru })}
                </p>
                <p className="whitespace-pre-wrap">{n.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-slate-900 dark:text-white text-2xl font-bold">Лента событий</h1>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors min-h-11 sm:min-h-0"
        >
          <Plus className="w-4 h-4" />
          Добавить
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-20 text-slate-500 dark:text-slate-500">
          <p className="text-lg mb-2">Пока нет событий</p>
          <p className="text-sm">Добавьте первое событие семьи!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onEdit={
                event.author.id === currentUserId ||
                currentUserRole === "ADMIN" ||
                currentUserRole === "SUPERADMIN"
                  ? () => {
                      setEditing(event);
                      setShowModal(true);
                    }
                  : undefined
              }
              onDeleted={handleDelete}
              onOpen={() => setDetailId(event.id)}
              onFocusComment={() => {
                setCommentEventId(event.id);
                setCommentText("");
              }}
              onNewComment={() => {
                setCommentEventId(event.id);
                setCommentText("");
              }}
            />
          ))}
        </div>
      )}

      {showModal && (
        <AddEventModal
          initialEvent={editing}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onSaved={mergeSavedEvent}
        />
      )}

      {detailId && (
        <EventDetailModal eventId={detailId} currentUserId={currentUserId} onClose={() => setDetailId(null)} />
      )}

      {commentEventId && (
        <div className="fixed bottom-0 left-0 right-0 z-[65] border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg">
          <div className="max-w-2xl mx-auto flex gap-2">
            <textarea
              ref={commentInputRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Комментарий к событию…"
              rows={2}
              className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white resize-none"
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={sendingComment || !commentText.trim()}
                onClick={() => void submitComment()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Отправить
              </button>
              <button
                type="button"
                onClick={() => {
                  setCommentEventId(null);
                  setCommentText("");
                }}
                className="text-xs text-slate-500"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
