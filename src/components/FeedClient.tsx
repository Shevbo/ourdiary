"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import EventCard, { type EventCardData } from "./EventCard";
import AddEventModal from "./AddEventModal";
import { useRouter } from "next/navigation";

export default function FeedClient({
  events: initialEvents,
  currentUserId,
}: {
  events: EventCardData[];
  currentUserId: string;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  function handleCreated() {
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-slate-900 dark:text-white text-2xl font-bold">Лента событий</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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
            <EventCard key={event.id} event={event} currentUserId={currentUserId} />
          ))}
        </div>
      )}

      {showModal && (
        <AddEventModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
