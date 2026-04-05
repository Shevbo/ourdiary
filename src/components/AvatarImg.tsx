"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<Size, string> = {
  xs: "h-7 w-7 min-h-7 min-w-7",
  sm: "h-9 w-9 min-h-9 min-w-9",
  md: "h-10 w-10 min-h-10 min-w-10",
  lg: "h-14 w-14 min-h-14 min-w-14",
  xl: "h-20 w-20 min-h-20 min-w-20",
};

const ICON_CLASS: Record<Size, string> = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
  xl: "h-10 w-10",
};

/**
 * Аватар как у куклы Дарuma: без next/image, светлый круглый фон под PNG/WebP,
 * object-cover, сброс при ошибке загрузки (битый URL после деплоя и т.п.).
 */
export default function AvatarImg({
  src,
  alt,
  name,
  size = "md",
  className,
  badge,
}: {
  src: string | null | undefined;
  alt: string;
  /** Для буквы-заглушки, если нет фото или картинка не загрузилась */
  name?: string | null;
  size?: Size;
  className?: string;
  badge?: React.ReactNode;
}) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  const initial = (name ?? "").trim().charAt(0).toUpperCase() || "?";
  const showPhoto = Boolean(src) && !broken;

  return (
    <span className={cn("relative inline-flex shrink-0", SIZE_CLASS[size], className)}>
      <span
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden rounded-full",
          "bg-slate-100 ring-1 ring-slate-300/80 dark:bg-slate-800 dark:ring-slate-600/80"
        )}
      >
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src!}
            alt={alt}
            width={256}
            height={256}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            referrerPolicy={src!.startsWith("/") ? undefined : "no-referrer"}
            onError={() => setBroken(true)}
          />
        ) : (
          <>
            {name?.trim() ? (
              <span
                className={cn(
                  "font-semibold text-slate-600 dark:text-slate-300",
                  size === "xs" && "text-xs",
                  size === "sm" && "text-sm",
                  (size === "md" || size === "lg") && "text-base",
                  size === "xl" && "text-2xl"
                )}
                aria-hidden
              >
                {initial}
              </span>
            ) : (
              <User className={cn("text-slate-500 dark:text-slate-400", ICON_CLASS[size])} aria-hidden />
            )}
          </>
        )}
      </span>
      {badge}
    </span>
  );
}
