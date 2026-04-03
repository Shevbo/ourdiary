"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookHeart, Calendar, DollarSign, Star, CheckSquare, Tv } from "lucide-react";

export default function LoginClient({ appVersion }: { appVersion: string }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && session) {
      router.replace("/");
    }
  }, [status, session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Неверный email или пароль");
      } else {
        router.replace("/");
      }
    } catch {
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-slate-500 dark:text-slate-400 text-lg">Загрузка…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-slate-900 dark:text-white font-semibold text-sm tracking-widest uppercase">
            Shectory
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center">
              <BookHeart className="w-4 h-4 text-white" />
            </div>
            <span className="text-slate-900 dark:text-white font-semibold text-sm">Наш дневник</span>
          </div>
          <span className="text-slate-500 dark:text-slate-500 text-xs">v{appVersion}</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">
        <div className="flex-1 flex flex-col justify-center px-8 py-12 lg:px-16 lg:py-20">
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/30">
                <BookHeart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Наш дневник</h1>
                <p className="text-slate-600 dark:text-slate-400 text-sm">Семейная социальная сеть</p>
              </div>
            </div>

            <p className="text-slate-700 dark:text-slate-300 text-lg leading-relaxed mb-10">
              Место, где семья живёт вместе — отмечает события, планирует будущее, следит за расходами и растёт в
              рейтинге семьянина.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FeatureCard
                icon={<BookHeart className="w-5 h-5 text-rose-500 dark:text-rose-400" />}
                title="Лента событий"
                desc="Записи дневника, важные моменты, воспоминания семьи"
                color="rose"
              />
              <FeatureCard
                icon={<Calendar className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />}
                title="Календарь и планы"
                desc="Культурные мероприятия, поездки, праздники на 1–2 месяца"
                color="indigo"
              />
              <FeatureCard
                icon={<DollarSign className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />}
                title="Учёт расходов"
                desc="Совместный бюджет семьи по категориям и периодам"
                color="emerald"
              />
              <FeatureCard
                icon={<CheckSquare className="w-5 h-5 text-amber-500 dark:text-amber-400" />}
                title="Задачи и обязанности"
                desc="Домашние дела, поручения, трекинг выполнения"
                color="amber"
              />
              <FeatureCard
                icon={<Star className="w-5 h-5 text-purple-500 dark:text-purple-400" />}
                title="Рейтинг семьянина"
                desc="Бонусные очки за активность, выполнение обязанностей"
                color="purple"
              />
              <FeatureCard
                icon={<Tv className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />}
                title="TV-режим"
                desc="Красивый дашборд для большого экрана 75&quot; в гостиной"
                color="cyan"
              />
            </div>
          </div>
        </div>

        <div className="lg:w-96 flex items-center justify-center px-8 py-12 lg:py-20">
          <div className="w-full max-w-sm">
            <div className="bg-white/90 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/10 rounded-2xl p-8 shadow-xl dark:shadow-2xl">
              <h2 className="text-slate-900 dark:text-white text-xl font-semibold mb-2">Вход в систему</h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                Вход по учётке портала Shectory: тот же email и пароль, что на{" "}
                <a
                  href="https://shectory.ru/login"
                  className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  shectory.ru
                </a>{" "}
                (на сервере должен быть задан <code className="text-xs">SHECTORY_AUTH_BRIDGE_SECRET</code>, см. RUNBOOK).
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="ваш@email.ru"
                    autoComplete="email"
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">
                    Пароль
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Введите пароль"
                    autoComplete="current-password"
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-600 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-2.5 transition"
                >
                  {loading ? "Вход…" : "Войти"}
                </button>
              </form>

              <div className="text-slate-500 dark:text-slate-600 text-xs mt-6 text-center space-x-3">
                <Link href="/security" className="underline hover:text-slate-700 dark:hover:text-slate-400">
                  Безопасность и поддержка
                </Link>
              </div>
              <p className="text-slate-500 dark:text-slate-600 text-xs mt-3 text-center">
                Доступ только для членов семьи
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
}) {
  const bgMap: Record<string, string> = {
    rose: "bg-rose-500/10 border-rose-500/20",
    indigo: "bg-indigo-500/10 border-indigo-500/20",
    emerald: "bg-emerald-500/10 border-emerald-500/20",
    amber: "bg-amber-500/10 border-amber-500/20",
    purple: "bg-purple-500/10 border-purple-500/20",
    cyan: "bg-cyan-500/10 border-cyan-500/20",
  };
  return (
    <div
      className={`rounded-xl border p-4 ${bgMap[color] ?? "bg-white/80 dark:bg-white/5 border-slate-200 dark:border-white/10"}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-slate-900 dark:text-white text-sm font-medium">{title}</span>
      </div>
      <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{desc}</p>
    </div>
  );
}
