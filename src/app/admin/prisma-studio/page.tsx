"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { createPostgresAdapter } from "@prisma/studio-core/data/postgres-core";
import { createStudioBFFClient } from "@prisma/studio-core/data/bff";
import "@prisma/studio-core/ui/index.css";

const Studio = dynamic(() => import("@prisma/studio-core/ui").then((mod) => mod.Studio), { ssr: false });

function isAdminRole(role: string | undefined) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export default function AdminPrismaStudioPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const adapter = useMemo(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const executor = createStudioBFFClient({
      url: `${base}/api/admin/studio`,
    });
    return createPostgresAdapter({ executor });
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!isAdminRole(session?.user?.role)) {
      router.replace("/");
    }
  }, [status, session?.user?.role, router]);

  if (status === "loading" || !isAdminRole(session?.user?.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-500 text-sm">
          {status === "loading" ? "Загрузка…" : "Нет доступа."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-2">
        <Link href="/admin" className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
          ← Администрирование
        </Link>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Prisma Studio</h1>
        <span className="text-xs text-slate-500">Таблицы БД (только для админов приложения)</span>
      </header>
      <main className="min-h-0 flex-1">
        <Studio adapter={adapter} />
      </main>
    </div>
  );
}
