"use client";

import { cn } from "@/lib/utils";

/** Условные иконки Дарумы по статусу мечты (п. 1.14.8). */
export function DarumaIcon({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const base = "inline-flex items-center justify-center rounded-full border-2 border-slate-700 bg-red-600 text-white";
  const size = cn("h-14 w-14 shrink-0", className);

  switch (status) {
    case "DRAFTING":
      return (
        <span className={cn(base, size)} title="Формируется" aria-hidden>
          <svg viewBox="0 0 48 48" className="h-10 w-10">
            <circle cx="24" cy="24" r="18" fill="currentColor" opacity={0.9} />
            <circle cx="17" cy="20" r="2.5" fill="#1e293b" opacity={0.15} />
            <circle cx="31" cy="20" r="2.5" fill="#1e293b" opacity={0.15} />
          </svg>
        </span>
      );
    case "ACTIVE":
      return (
        <span className={cn(base, size)} title="Активная" aria-hidden>
          <svg viewBox="0 0 48 48" className="h-10 w-10">
            <circle cx="24" cy="24" r="18" fill="currentColor" opacity={0.9} />
            <circle cx="17" cy="20" r="2.5" fill="#0f172a" />
            <circle cx="31" cy="20" r="2.5" fill="#1e293b" opacity={0.2} />
          </svg>
        </span>
      );
    case "FULFILLED":
      return (
        <span className={cn(base, size, "relative")} title="Сбылась" aria-hidden>
          <svg viewBox="0 0 48 48" className="h-10 w-10">
            <circle cx="24" cy="24" r="18" fill="currentColor" opacity={0.9} />
            <circle cx="17" cy="20" r="2.5" fill="#0f172a" />
            <circle cx="31" cy="20" r="2.5" fill="#0f172a" />
            <path d="M24 32 L28 36 L34 28" stroke="#fbbf24" strokeWidth="2" fill="none" />
          </svg>
        </span>
      );
    case "POSTPONED":
      return (
        <span className={cn("inline-flex h-14 w-14 items-center justify-center text-amber-800 dark:text-amber-200", className)} title="Отложена" aria-hidden>
          <svg viewBox="0 0 48 48" className="h-12 w-12">
            <rect x="8" y="14" width="32" height="24" rx="3" fill="currentColor" opacity={0.35} />
            <rect x="10" y="16" width="28" height="8" rx="1" fill="currentColor" opacity={0.5} />
          </svg>
        </span>
      );
    case "DROPPED":
      return (
        <span className={cn("inline-flex h-14 w-14 items-center justify-center text-slate-600", className)} title="Сброшена" aria-hidden>
          <svg viewBox="0 0 48 48" className="h-12 w-12">
            <rect x="10" y="12" width="28" height="30" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M16 18h16M16 24h12" stroke="currentColor" strokeWidth="2" />
          </svg>
        </span>
      );
    default:
      return <span className={cn(base, size)}>?</span>;
  }
}

export const DREAM_STATUS_LABEL: Record<string, string> = {
  DRAFTING: "Формируется",
  ACTIVE: "Активная",
  FULFILLED: "Сбылась",
  POSTPONED: "Отложена",
  DROPPED: "Сброшена",
};
