"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import EventCard, { type EventCardData } from "./EventCard";
import AddEventModal from "./AddEventModal";
import { useRouter } from "next/navigation";

export default function FeedClient({
  events: initialEvents,
  currentUserId,
  currentUserRole,
}: {
  events: EventCardData[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EventCardData | null>(null);
  const router = useRouter();

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

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

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
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
              onEdit={() => {
                setEditing(event);
                setShowModal(true);
              }}
              onDeleted={handleDelete}
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
    </div>
  );
}
