"use client";

import { cn } from "@/lib/utils";

/** Статика в `public/` — файл должен быть настоящим PNG (не WebP с расширением .png). */
const DARUMA_SRC = "/images/daruma-doll.png";

/** Позиции зрачков относительно квадратного кадра 360×360 (традиция: сначас красят глаз справа у зрителя). */
const EYE = {
  /** Левый глаз зрителя (правый глаз куклы) — первым закрашивают при обещании */
  first: "left-[61%] top-[34%]",
  /** Правый глаз зрителя — второй */
  second: "left-[39%] top-[34%]",
} as const;

function Pupils({
  mode,
}: {
  mode: "none" | "first" | "both";
}) {
  const dot =
    "absolute h-[11%] w-[11%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-950 shadow-[inset_0_-1px_0_rgba(255,255,255,0.15)]";
  return (
    <>
      {(mode === "first" || mode === "both") && <span className={cn(dot, EYE.first)} aria-hidden />}
      {mode === "both" && <span className={cn(dot, EYE.second)} aria-hidden />}
    </>
  );
}

type DarumaIconProps = {
  status: string;
  className?: string;
};

/** Кукла Дарума по статусу мечты (п. 1.14.8): белые глаза → один зрачок → оба; отложена/сброшена — тот же образ с фильтром. */
function DollImg({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- избегаем layout/placeholder next/image у круглой маски
    <img src={DARUMA_SRC} alt="" width={56} height={56} className={cn("h-full w-full object-cover", className)} loading="lazy" decoding="async" />
  );
}

export function DarumaIcon({ status, className }: DarumaIconProps) {
  const frame = cn(
    "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-300/80 dark:bg-slate-800 dark:ring-slate-600/80",
    "h-14 w-14",
    className
  );

  switch (status) {
    case "DRAFTING":
      return (
        <span className={frame} title="Формируется">
          <DollImg />
          <Pupils mode="none" />
        </span>
      );
    case "ACTIVE":
      return (
        <span className={frame} title="Активная">
          <DollImg />
          <Pupils mode="first" />
        </span>
      );
    case "FULFILLED":
      return (
        <span className={frame} title="Сбылась">
          <DollImg />
          <Pupils mode="both" />
        </span>
      );
    case "POSTPONED":
      return (
        <span className={frame} title="Отложена">
          <DollImg className="saturate-[0.65] opacity-95" />
          <span className="pointer-events-none absolute inset-0 bg-amber-400/15 mix-blend-overlay" aria-hidden />
          <Pupils mode="none" />
        </span>
      );
    case "DROPPED":
      return (
        <span className={frame} title="Сброшена">
          <DollImg className="grayscale opacity-[0.72]" />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
            <span className="h-[2.5px] w-[130%] rotate-45 rounded-full bg-white/60 shadow-sm" />
          </span>
        </span>
      );
    default:
      return (
        <span className={frame}>
          <DollImg className="opacity-80" />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200 drop-shadow">?</span>
        </span>
      );
  }
}

export const DREAM_STATUS_LABEL: Record<string, string> = {
  DRAFTING: "Формируется",
  ACTIVE: "Активная",
  FULFILLED: "Сбылась",
  POSTPONED: "Отложена",
  DROPPED: "Сброшена",
};
