import { cn } from "@/lib/utils";

/**
 * Иконка «сембон» (семейный бонус). Ассет: `public/sembon.png`.
 * Размер задаётся через `className` (например `h-4 w-4`, `w-5 h-5`).
 */
export default function SembonIcon({
  className,
  title,
}: {
  className?: string;
  /** Для доступности, если иконка несёт смысл без подписи */
  title?: string;
}) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/sembon.png" alt="" className="h-full w-full object-contain" draggable={false} />
    </span>
  );
}
