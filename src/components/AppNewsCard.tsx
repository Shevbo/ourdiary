"use client";

import { useRef, useState } from "react";
import { ThumbsUp, ThumbsDown, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Vote = { value: "UP" | "DOWN"; userId: string };

export type AppNewsCardData = {
  id: string;
  body: string;
  createdAt: string;
  votes: Vote[];
  _count: { comments: number };
  reactions?: { emoji: string; count: number; me: boolean }[];
};

const QUICK_EMOJI = ["👍", "❤️", "😂", "😮", "🎉"];

export default function AppNewsCard({
  item,
  currentUserId,
  dateLabel,
  onFocusComment,
  onNewComment,
}: {
  item: AppNewsCardData;
  currentUserId: string;
  dateLabel: string;
  onFocusComment?: () => void;
  onNewComment?: () => void;
}) {
  const myVote = item.votes.find((v) => v.userId === currentUserId);
  const [upCount, setUpCount] = useState(item.votes.filter((v) => v.value === "UP").length);
  const [downCount, setDownCount] = useState(item.votes.filter((v) => v.value === "DOWN").length);
  const [myVoteVal, setMyVoteVal] = useState<"UP" | "DOWN" | null>(myVote?.value ?? null);
  const [voting, setVoting] = useState(false);
  const [reactions, setReactions] = useState(item.reactions ?? []);
  const [reacting, setReacting] = useState(false);

  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFiredRef = useRef(false);

  async function handleVote(value: "UP" | "DOWN") {
    if (voting) return;
    setVoting(true);
    try {
      const res = await fetch(`/api/app-news/${item.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const data = (await res.json()) as { action?: string };
      if (data.action === "removed") {
        if (value === "UP") setUpCount((c) => Math.max(0, c - 1));
        else setDownCount((c) => Math.max(0, c - 1));
        setMyVoteVal(null);
      } else if (data.action === "created") {
        if (value === "UP") setUpCount((c) => c + 1);
        else setDownCount((c) => c + 1);
        setMyVoteVal(value);
      } else if (data.action === "updated") {
        if (value === "UP") {
          setUpCount((c) => c + 1);
          setDownCount((c) => Math.max(0, c - 1));
        } else {
          setDownCount((c) => c + 1);
          setUpCount((c) => Math.max(0, c - 1));
        }
        setMyVoteVal(value);
      }
    } finally {
      setVoting(false);
    }
  }

  async function toggleEmoji(emoji: string) {
    if (reacting) return;
    setReacting(true);
    try {
      const res = await fetch(`/api/app-news/${item.id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) return;
      const fresh = await fetch(`/api/app-news/${item.id}`);
      if (!fresh.ok) return;
      const data = (await fresh.json()) as { reactions?: { emoji: string; userId: string }[] };
      const map = new Map<string, { emoji: string; count: number; me: boolean }>();
      for (const r of data.reactions ?? []) {
        const cur = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, me: false };
        cur.count += 1;
        if (r.userId === currentUserId) cur.me = true;
        map.set(r.emoji, cur);
      }
      setReactions([...map.values()].sort((a, b) => b.count - a.count));
    } finally {
      setReacting(false);
    }
  }

  function handleCardPointerDown() {
    if (!onFocusComment) return;
    longFiredRef.current = false;
    longPressRef.current = setTimeout(() => {
      longFiredRef.current = true;
      onFocusComment();
    }, 500);
  }

  function clearLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function handleCardClick(e: React.MouseEvent) {
    if (longFiredRef.current) {
      longFiredRef.current = false;
      return;
    }
    if ((e.target as HTMLElement).closest("button, a")) return;
    if (!onFocusComment && !onNewComment) return;

    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      const n = tapCountRef.current;
      tapCountRef.current = 0;
      if (n === 2) onFocusComment?.();
      else if (n >= 3) onNewComment?.();
    }, 280);
  }

  return (
    <article className="rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700 overflow-hidden shadow-sm dark:shadow-none">
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onPointerDown={handleCardPointerDown}
        onPointerUp={clearLongPress}
        onPointerLeave={clearLongPress}
        onPointerCancel={clearLongPress}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onFocusComment?.();
          }
        }}
        className={cn(
          "text-left w-full outline-none px-4 py-3",
          (onFocusComment || onNewComment) && "cursor-pointer"
        )}
      >
        <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">{dateLabel}</p>
        <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200 text-sm leading-relaxed">{item.body}</p>
      </div>

      <div className="px-4 pb-3 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
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
                  ? "border-indigo-500 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                  : "border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <span>{e}</span>
              {row && row.count > 0 && <span className="text-xs text-slate-500">{row.count}</span>}
            </button>
          );
        })}
      </div>

      <div
        className="flex items-center gap-3 px-4 pb-4 pt-0 border-t border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => void handleVote("UP")}
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
          type="button"
          onClick={() => void handleVote("DOWN")}
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
          <span>{item._count.comments}</span>
        </div>
      </div>
    </article>
  );
}
