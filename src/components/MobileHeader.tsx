"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { User } from "lucide-react";

export default function MobileHeader() {
  const { status } = useSession();
  const [me, setMe] = useState<{
    name?: string | null;
    email?: string;
    avatarUrl?: string | null;
    unreadNotifications?: number;
  } | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    void (async () => {
      const res = await fetch("/api/me");
      if (!res.ok) return;
      setMe(await res.json());
    })();
  }, [status]);

  if (status !== "authenticated" || !me) return null;

  const name = me.name ?? me.email ?? "";
  const avatar = me.avatarUrl;

  return (
    <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <Link href="/me" className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-300 dark:bg-slate-700 dark:ring-slate-600">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-slate-500">
              <User className="h-5 w-5" />
            </span>
          )}
          {(me.unreadNotifications ?? 0) > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
              {(me.unreadNotifications ?? 0) > 99 ? "99+" : me.unreadNotifications}
            </span>
          )}
        </span>
        <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{name}</span>
      </Link>
    </header>
  );
}
