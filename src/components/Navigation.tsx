"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import {
  BookHeart,
  Calendar,
  Wallet,
  CheckSquare,
  Tv,
  LogOut,
  Shield,
  User,
  Sparkles,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import AvatarImg from "./AvatarImg";
import SembonIcon from "./SembonIcon";

const NAV_ORDER_KEY = "ourdiary-nav-order";

const navItems = [
  { href: "/", label: "Лента", icon: BookHeart },
  { href: "/calendar", label: "Календарь", icon: Calendar },
  { href: "/expenses", label: "Расходы", icon: Wallet },
  { href: "/tasks", label: "Задачи", icon: CheckSquare },
  { href: "/dreams", label: "Мечты", icon: Sparkles },
  { href: "/rating", label: "Сембон", icon: SembonIcon },
  { href: "/tv", label: "TV", icon: Tv },
];

const DEFAULT_HREFS = navItems.map((i) => i.href);

function mergeNavOrder(saved: string[] | null): string[] {
  if (!saved?.length) return [...DEFAULT_HREFS];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of saved) {
    if (DEFAULT_HREFS.includes(h) && !seen.has(h)) {
      out.push(h);
      seen.add(h);
    }
  }
  for (const h of DEFAULT_HREFS) {
    if (!seen.has(h)) out.push(h);
  }
  return out;
}

export default function Navigation() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERADMIN";
  const [cabinetMe, setCabinetMe] = useState<{
    unreadNotifications?: number;
    avatarUrl?: string | null;
    name?: string | null;
  } | null>(null);
  const [navOrder, setNavOrder] = useState<string[]>(DEFAULT_HREFS);
  const [showOrderModal, setShowOrderModal] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NAV_ORDER_KEY);
      if (!raw) return;
      const next = mergeNavOrder(JSON.parse(raw) as string[]);
      queueMicrotask(() => setNavOrder(next));
    } catch {
      /* ignore */
    }
  }, []);

  const orderedNavItems = useMemo(() => {
    const byHref = new Map(navItems.map((i) => [i.href, i] as const));
    return navOrder.map((h) => byHref.get(h)).filter(Boolean) as typeof navItems;
  }, [navOrder]);

  function moveHref(href: string, dir: -1 | 1) {
    setNavOrder((prev) => {
      const i = prev.indexOf(href);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => {
    if (status !== "authenticated") return;
    void (async () => {
      const res = await fetch("/api/me");
      if (!res.ok) return;
      setCabinetMe(await res.json());
    })();
  }, [status, pathname]);

  useEffect(() => {
    const onUpdate = () => {
      void (async () => {
        const res = await fetch("/api/me");
        if (!res.ok) return;
        setCabinetMe(await res.json());
      })();
    };
    window.addEventListener("ourdiary-profile-updated", onUpdate);
    return () => window.removeEventListener("ourdiary-profile-updated", onUpdate);
  }, []);

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-56 min-h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 fixed left-0 top-0 z-40">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="w-7 h-7 bg-rose-500 rounded-lg flex items-center justify-center">
            <BookHeart className="w-4 h-4 text-white" />
          </div>
          <span className="text-slate-900 dark:text-white font-semibold text-sm">Наш дневник</span>
        </div>

        <div className="flex-1 py-4 px-3 space-y-1">
          <Link
            href="/me"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              pathname === "/me"
                ? "bg-indigo-600 text-white"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <span className="relative flex-shrink-0">
              <User className="w-4 h-4" />
              {(cabinetMe?.unreadNotifications ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1rem] h-4 px-0.5 rounded-full bg-rose-500 text-white text-[10px] leading-4 text-center font-semibold">
                  {(cabinetMe?.unreadNotifications ?? 0) > 99
                    ? "99+"
                    : cabinetMe?.unreadNotifications ?? 0}
                </span>
              )}
            </span>
            Кабинет
          </Link>
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname === "/admin"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <Shield className="w-4 h-4 flex-shrink-0" />
              Администрирование
            </Link>
          )}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 px-3 py-4">
          <div className="flex items-center gap-2 px-3 py-2 mb-2">
            <AvatarImg
              src={cabinetMe?.avatarUrl}
              alt=""
              name={cabinetMe?.name ?? session?.user?.name ?? session?.user?.email}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 dark:text-white text-xs font-medium truncate">
                {cabinetMe?.name ?? session?.user?.name ?? session?.user?.email}
              </p>
              <p className="text-slate-500 text-xs truncate">{session?.user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-2 w-full px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Выйти
          </button>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-stretch gap-0.5 px-1 py-1.5">
          <div className="flex min-w-0 flex-1 items-center overflow-x-auto scrollbar-none gap-0.5 pr-1">
            {orderedNavItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 transition-colors min-w-[3.5rem]",
                  pathname === href ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-500"
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-[10px] leading-tight text-center max-w-[4.5rem] truncate">{label}</span>
              </Link>
            ))}
          </div>
          <button
            type="button"
            title="Порядок вкладок"
            onClick={() => setShowOrderModal(true)}
            className="flex w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400"
          >
            <GripVertical className="w-5 h-5" />
            <span className="text-[9px]">Порядок</span>
          </button>
        </div>
      </nav>

      {showOrderModal && (
        <div className="md:hidden fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0">
          <button type="button" className="absolute inset-0" aria-label="Закрыть" onClick={() => setShowOrderModal(false)} />
          <div className="relative z-10 w-full max-h-[70vh] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Порядок вкладок (снизу)</p>
            <ul className="space-y-2">
              {orderedNavItems.map(({ href, label }, idx) => (
                <li
                  key={href}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/80"
                >
                  <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">{label}</span>
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveHref(href, -1)}
                    className="rounded p-1 text-slate-600 disabled:opacity-30 dark:text-slate-400"
                    aria-label="Выше"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === orderedNavItems.length - 1}
                    onClick={() => moveHref(href, 1)}
                    className="rounded p-1 text-slate-600 disabled:opacity-30 dark:text-slate-400"
                    aria-label="Ниже"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowOrderModal(false)}
              className="mt-4 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white"
            >
              Готово
            </button>
          </div>
        </div>
      )}
    </>
  );
}
