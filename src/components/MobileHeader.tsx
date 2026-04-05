"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import AvatarImg from "./AvatarImg";

export default function MobileHeader() {
  const { status } = useSession();
  const [me, setMe] = useState<{
    name?: string | null;
    email?: string;
    avatarUrl?: string | null;
    unreadNotifications?: number;
  } | null>(null);

  const loadMe = useCallback(() => {
    void (async () => {
      const res = await fetch("/api/me");
      if (!res.ok) return;
      setMe(await res.json());
    })();
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadMe();
  }, [status, loadMe]);

  useEffect(() => {
    const onUpdate = () => loadMe();
    window.addEventListener("ourdiary-profile-updated", onUpdate);
    return () => window.removeEventListener("ourdiary-profile-updated", onUpdate);
  }, [loadMe]);

  if (status !== "authenticated" || !me) return null;

  const name = me.name ?? me.email ?? "";
  const unread = me.unreadNotifications ?? 0;

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:pl-6">
      <Link href="/me" className="flex min-w-0 flex-1 items-center gap-2.5">
        <AvatarImg
          src={me.avatarUrl}
          alt=""
          name={name}
          size="md"
          badge={
            unread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null
          }
        />
        <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{name}</span>
      </Link>
    </header>
  );
}
