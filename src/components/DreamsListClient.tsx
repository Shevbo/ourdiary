"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { DarumaIcon, DREAM_STATUS_LABEL } from "./DarumaStatus";

type DreamRow = {
  id: string;
  orderNo: number;
  shortTitle: string;
  status: string;
  lockedAt: string | null;
  author: { id: string; name: string | null; avatarUrl: string | null };
};

export default function DreamsListClient() {
  const [dreams, setDreams] = useState<DreamRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/dreams");
        if (res.ok) {
          const data = (await res.json()) as DreamRow[];
          setDreams(data);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="text-slate-500 py-12 text-center">Загрузка…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-amber-500" />
          <div>
            <h1 className="text-slate-900 dark:text-white text-2xl font-bold">Воплоти мечту</h1>
            <p className="text-slate-500 dark:text-slate-500 text-sm">
              Видны только ваши мечты и те, где вас ждут в поддержке.
            </p>
          </div>
        </div>
        <Link
          href="/dreams/new"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          Новая мечта
        </Link>
      </div>

      {dreams.length === 0 ? (
        <p className="text-slate-500 text-center py-16">Пока нет мечт. Создайте первую.</p>
      ) : (
        <ul className="space-y-3">
          {dreams.map((d) => (
            <li key={d.id}>
              <Link
                href={`/dreams/${d.id}`}
                className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-indigo-500/40 transition-colors"
              >
                <span className="text-slate-400 text-sm w-8 text-right">#{d.orderNo}</span>
                <DarumaIcon status={d.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 dark:text-white font-medium truncate">{d.shortTitle}</p>
                  <p className="text-slate-500 text-xs">
                    {DREAM_STATUS_LABEL[d.status] ?? d.status}
                    {d.lockedAt && " · зафиксирована"}
                    {" · "}
                    {d.author.name ?? "автор"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
