"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  BookHeart,
  Calendar,
  Wallet,
  CheckSquare,
  Star,
  Tv,
  LogOut,
  Shield,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Лента", icon: BookHeart },
  { href: "/calendar", label: "Календарь", icon: Calendar },
  { href: "/expenses", label: "Расходы", icon: Wallet },
  { href: "/tasks", label: "Задачи", icon: CheckSquare },
  { href: "/rating", label: "Сембон", icon: Star },
  { href: "/tv", label: "TV", icon: Tv },
];

export default function Navigation() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERADMIN";

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
            <User className="w-4 h-4 flex-shrink-0" />
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
            <div className="w-7 h-7 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 dark:text-white text-xs font-medium truncate">
                {session?.user?.name ?? session?.user?.email}
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
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.slice(0, 5).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors",
                pathname === href ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-500"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
