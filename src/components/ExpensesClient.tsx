"use client";

import dynamic from "next/dynamic";
import { useState, useMemo, useCallback } from "react";
import { Plus, X, DollarSign, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn, formatMoney, EXPENSE_CATEGORY_LABELS } from "@/lib/utils";

type Expense = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  note: string | null;
  author: { id: string; name: string | null; avatarUrl: string | null };
};

const CATEGORIES = Object.entries(EXPENSE_CATEGORY_LABELS);

const ReceiptQrScanner = dynamic(() => import("./ReceiptQrScanner"), { ssr: false });

const CATEGORY_COLORS: Record<string, string> = {
  FOOD: "bg-orange-500/20 text-orange-400",
  TRANSPORT: "bg-blue-500/20 text-blue-400",
  ENTERTAINMENT: "bg-purple-500/20 text-purple-400",
  HEALTH: "bg-red-500/20 text-red-400",
  EDUCATION: "bg-cyan-500/20 text-cyan-400",
  CLOTHING: "bg-pink-500/20 text-pink-400",
  HOME: "bg-amber-500/20 text-amber-400",
  VACATION: "bg-emerald-500/20 text-emerald-400",
  SHOPPING_PLAN: "bg-teal-500/20 text-teal-400",
  OTHER: "bg-slate-500/20 text-slate-400",
};

export default function ExpensesClient({
  expenses: initialExpenses,
  monthlyTotals,
}: {
  expenses: Expense[];
  monthlyTotals: { label: string; total: number }[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const router = useRouter();

  // Form state
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showQrScanner, setShowQrScanner] = useState(false);

  const filtered = useMemo(() => {
    let list = initialExpenses;
    if (filterCategory) list = list.filter((e) => e.category === filterCategory);
    if (filterPeriod !== "all") {
      const now = new Date();
      const from = new Date();
      if (filterPeriod === "month") from.setDate(1);
      if (filterPeriod === "week") from.setDate(now.getDate() - 7);
      if (filterPeriod === "year") from.setMonth(0, 1);
      list = list.filter((e) => new Date(e.date) >= from);
    }
    return list;
  }, [initialExpenses, filterCategory, filterPeriod]);

  const totalByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of filtered) {
      map[e.category] = (map[e.category] ?? 0) + e.amount;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const grandTotal = filtered.reduce((s, e) => s + e.amount, 0);
  const maxCat = totalByCategory[0]?.[1] ?? 1;
  const maxMonth = Math.max(...monthlyTotals.map((m) => m.total), 1);
  const chartW = 320;
  const chartH = 120;
  const barGap = 4;
  const barW = (chartW - barGap * (monthlyTotals.length + 1)) / monthlyTotals.length;

  const importFromReceipt = useCallback(
    async (raw: string) => {
      setError("");
      setLoading(true);
      try {
        const res = await fetch("/api/expenses/from-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrraw: raw }),
        });
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(d.error ?? "Не удалось импортировать чек");
          return;
        }
        setShowQrScanner(false);
        setShowForm(false);
        router.refresh();
      } catch {
        setError("Ошибка соединения");
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, amount: parseFloat(amount), category, date, note: note || undefined }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Ошибка");
        return;
      }
      router.refresh();
      setShowForm(false);
      setTitle(""); setAmount(""); setCategory("OTHER"); setNote("");
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-slate-900 dark:text-white text-2xl font-bold">Расходы семьи</h1>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors min-h-11 sm:min-h-0"
        >
          <Plus className="w-4 h-4" />
          Ввести расход
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-11 md:min-h-0"
        >
          <option value="">Все категории</option>
          {CATEGORIES.map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <select
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value)}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-11 md:min-h-0"
        >
          <option value="all">Всё время</option>
          <option value="week">Неделя</option>
          <option value="month">Месяц</option>
          <option value="year">Год</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart / summary */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span className="text-slate-500 dark:text-slate-400 text-sm">Итого (фильтр)</span>
            </div>
            <p className="text-slate-900 dark:text-white text-2xl font-bold">{formatMoney(grandTotal)}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm dark:shadow-none">
            <h3 className="text-slate-700 dark:text-slate-300 text-sm font-medium mb-3">Расходы по месяцам</h3>
            <svg
              viewBox={`0 0 ${chartW} ${chartH + 24}`}
              className="w-full h-auto text-indigo-500"
              role="img"
              aria-label="График расходов по месяцам"
            >
              <title>Расходы по месяцам</title>
              {monthlyTotals.map((m, i) => {
                const h = maxMonth > 0 ? (m.total / maxMonth) * chartH : 0;
                const x = barGap + i * (barW + barGap);
                const y = chartH - h;
                return (
                  <g key={m.label + i}>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(h, 0)}
                      rx={2}
                      className="fill-indigo-500 dark:fill-indigo-500 opacity-90"
                    />
                    <text
                      x={x + barW / 2}
                      y={chartH + 14}
                      textAnchor="middle"
                      className="fill-slate-500 text-[8px] font-sans"
                    >
                      {m.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {totalByCategory.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm dark:shadow-none">
              <h3 className="text-slate-700 dark:text-slate-300 text-sm font-medium mb-3">По категориям</h3>
              <div className="space-y-2.5">
                {totalByCategory.map(([cat, sum]) => (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500 dark:text-slate-400">{EXPENSE_CATEGORY_LABELS[cat]}</span>
                      <span className="text-slate-900 dark:text-white">{formatMoney(sum)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${(sum / maxCat) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* List */}
        <div className="lg:col-span-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <p>Нет расходов за выбранный период</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((e) => (
                <div
                  key={e.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm dark:shadow-none"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-900 dark:text-white text-sm font-medium">{e.title}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", CATEGORY_COLORS[e.category])}>
                        {EXPENSE_CATEGORY_LABELS[e.category]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-slate-500 text-xs">
                        {format(new Date(e.date), "d MMM yyyy", { locale: ru })}
                      </span>
                      <span className="text-slate-600 text-xs">·</span>
                      <span className="text-slate-500 text-xs">{e.author.name ?? e.author.id}</span>
                      {e.note && <span className="text-slate-600 text-xs truncate">· {e.note}</span>}
                    </div>
                  </div>
                  <span className="text-slate-900 dark:text-white font-semibold text-sm flex-shrink-0">
                    {formatMoney(e.amount, e.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between gap-2 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-slate-900 dark:text-white font-semibold text-lg">Новый расход</h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowQrScanner(true)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 min-h-11 sm:min-h-0"
                  title="Сканировать QR чека"
                >
                  <QrCode className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">QR чека</span>
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white min-h-11 min-w-11 flex items-center justify-center sm:min-h-0 sm:min-w-0">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Название *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Продукты, кино, такси…"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Сумма (₽) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Дата</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Категория</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CATEGORIES.map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Заметка</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Необязательно"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-600 dark:text-red-400 text-sm">{error}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 font-medium rounded-lg px-4 py-2.5 transition-colors text-sm min-h-11 sm:min-h-0"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={cn("flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-4 py-2.5 transition-colors text-sm", loading && "opacity-60 cursor-not-allowed")}
                >
                  {loading ? "Сохранение…" : "Добавить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQrScanner && (
        <ReceiptQrScanner
          onDecoded={importFromReceipt}
          onClose={() => setShowQrScanner(false)}
        />
      )}
    </div>
  );
}
