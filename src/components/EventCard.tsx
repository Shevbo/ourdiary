"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageCircle, ExternalLink, BookHeart, Calendar, Gift, Sun, Bell } from "lucide-react";
import { formatDate, EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, cn } from "@/lib/utils";

type Vote = { value: "UP" | "DOWN"; userId: string };
type Link = { id: string; label: string; url: string };
type Author = { id: string; name: string | null; avatarUrl: string | null };

export type EventCardData = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  date: string | Date;
  imageUrl: string | null;
  author: Author;
  links: Link[];
  votes: Vote[];
  _count: { comments: number; votes: number };
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  DIARY: <BookHeart className="w-4 h-4" />,
  PLAN: <Calendar className="w-4 h-4" />,
  BIRTHDAY: <Gift className="w-4 h-4" />,
  HOLIDAY: <Sun className="w-4 h-4" />,
  REMINDER: <Bell className="w-4 h-4" />,
};

export default function EventCard({
  event,
  currentUserId,
}: {
  event: EventCardData;
  currentUserId: string;
}) {
  const myVote = event.votes.find((v) => v.userId === currentUserId);
  const [upCount, setUpCount] = useState(event.votes.filter((v) => v.value === "UP").length);
  const [downCount, setDownCount] = useState(event.votes.filter((v) => v.value === "DOWN").length);
  const [myVoteVal, setMyVoteVal] = useState<"UP" | "DOWN" | null>(myVote?.value ?? null);
  const [voting, setVoting] = useState(false);

  async function handleVote(value: "UP" | "DOWN") {
    if (voting) return;
    setVoting(true);
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, value }),
      });
      const data = await res.json();
      if (data.action === "removed") {
        if (value === "UP") setUpCount((c) => c - 1);
        else setDownCount((c) => c - 1);
        setMyVoteVal(null);
      } else if (data.action === "created") {
        if (value === "UP") setUpCount((c) => c + 1);
        else setDownCount((c) => c + 1);
        setMyVoteVal(value);
      } else if (data.action === "updated") {
        if (value === "UP") { setUpCount((c) => c + 1); setDownCount((c) => c - 1); }
        else { setDownCount((c) => c + 1); setUpCount((c) => c - 1); }
        setMyVoteVal(value);
      }
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm dark:shadow-none">
      {event.imageUrl && (
        <div className="h-48 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", EVENT_TYPE_COLORS[event.type])}>
              {TYPE_ICONS[event.type]}
              {EVENT_TYPE_LABELS[event.type] ?? event.type}
            </span>
            <span className="text-slate-500 dark:text-slate-500 text-xs">{formatDate(event.date)}</span>
          </div>
          <span className="text-slate-500 dark:text-slate-500 text-xs flex-shrink-0">
            {event.author.name ?? event.author.id}
          </span>
        </div>

        <h3 className="text-slate-900 dark:text-white font-semibold text-base mb-1 leading-snug">{event.title}</h3>

        {event.description && (
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed line-clamp-3 mb-3">
            {event.description}
          </p>
        )}

        {event.links.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {event.links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-lg transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                {link.label}
              </a>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => handleVote("UP")}
            disabled={voting}
            className={cn(
              "flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg transition-colors",
              myVoteVal === "UP"
                ? "bg-emerald-500/20 text-emerald-400"
                : "text-slate-500 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10"
            )}
          >
            <ThumbsUp className="w-4 h-4" />
            <span>{upCount}</span>
          </button>
          <button
            onClick={() => handleVote("DOWN")}
            disabled={voting}
            className={cn(
              "flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg transition-colors",
              myVoteVal === "DOWN"
                ? "bg-red-500/20 text-red-400"
                : "text-slate-500 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10"
            )}
          >
            <ThumbsDown className="w-4 h-4" />
            <span>{downCount}</span>
          </button>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-500 text-sm ml-auto">
            <MessageCircle className="w-4 h-4" />
            <span>{event._count.comments}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
