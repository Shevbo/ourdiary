"use client";

import dynamic from "next/dynamic";
import { useState, useMemo, useCallback, useEffect } from "react";
import { Plus, X, Wallet, QrCode, Pencil, Trash2 } from "lucide-react";
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
  beneficiary: string;
  beneficiaryUserId: string | null;
  placeId: string | null;
  author: { id: string; name: string | null; avatarUrl: string | null };
  beneficiaryUser: { id: string; name: string | null } | null;
  place: { id: string; name: string } | null;
};

type UserOpt = { id: string; name: string | null };

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

/** Заливка сегментов столбика «по месяцам» */
const CATEGORY_BAR_FILL: Record<string, string> = {
  FOOD: "#f97316",
  TRANSPORT: "#3b82f6",
  ENTERTAINMENT: "#a855f7",
  HEALTH: "#ef4444",
  EDUCATION: "#06b6d4",
  CLOTHING: "#ec4899",
  HOME: "#d97706",
  VACATION: "#10b981",
  SHOPPING_PLAN: "#14b8a6",
  OTHER: "#64748b",
};

const CATEGORY_STACK_ORDER = Object.keys(CATEGORY_BAR_FILL);

export default function ExpensesClient({
  expenses: initialExpenses,
  monthlyTotals,
  currentUserId,
  currentUserRole,
}: {
  expenses: Expense[];
  monthlyTotals: { label: string; total: number; byCategory: Partial<Record<string, number>> }[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const router = useRouter();
  const [familyUsers, setFamilyUsers] = useState<UserOpt[]>([]);
  const [places, setPlaces] = useState<{ id: string; name: string }[]>([]);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [beneficiary, setBeneficiary] = useState<"FAMILY" | "MEMBER">("FAMILY");
  const [beneficiaryUserId, setBeneficiaryUserId] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [newPlaceName, setNewPlaceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showQrScanner, setShowQrScanner] = useState(false);

  const isAdmin = currentUserRole === "ADMIN" || currentUserRole === "SUPERADMIN";

  useEffect(() => {
    setExpenses(initialExpenses);
  }, [initialExpenses]);

  useEffect(() => {
    void (async () => {
      try {
        const [uRes, pRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/expense-places"),
        ]);
        if (uRes.ok) {
          const list = (await uRes.json()) as UserOpt[];
          setFamilyUsers(list);
        }
        if (pRes.ok) setPlaces(await pRes.json());
      } catch {
        /* ignore */
      }
    })();
  }, []);

  function openCreate() {
    setEditingId(null);
    setTitle("");
    setAmount("");
    setCategory("OTHER");
    setDate(new Date().toISOString().slice(0, 10));
    setNote("");
    setBeneficiary("FAMILY");
    setBeneficiaryUserId("");
    setPlaceId("");
    setNewPlaceName("");
    setError("");
    setShowForm(true);
  }

  function openEdit(e: Expense) {
    setEditingId(e.id);
    setTitle(e.title);
    setAmount(String(e.amount));
    setCategory(e.category);
    setDate(e.date.slice(0, 10));
    setNote(e.note ?? "");
    setBeneficiary(e.beneficiary === "MEMBER" ? "MEMBER" : "FAMILY");
    setBeneficiaryUserId(e.beneficiaryUserId ?? "");
    setPlaceId(e.placeId ?? "");
    setNewPlaceName("");
    setError("");
    setShowForm(true);
  }

  const filtered = useMemo(() => {
    let list = expenses;
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
  }, [expenses, filterCategory, filterPeriod]);

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

  async function ensureNewPlace(): Promise<string | undefined> {
    const n = newPlaceName.trim();
    if (!n) return placeId || undefined;
    const res = await fetch("/api/expense-places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n }),
    });
    if (!res.ok) return placeId || undefined;
    const p = (await res.json()) as { id: string; name: string };
    setPlaces((prev) => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)));
    setPlaceId(p.id);
    setNewPlaceName("");
    return p.id;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    setLoading(true);
    try {
      let pid = placeId || undefined;
      if (newPlaceName.trim()) {
        pid = await ensureNewPlace();
      }
      const payload = {
        title,
        amount: parseFloat(amount),
        category,
        date,
        note: note || undefined,
        beneficiary,
        beneficiaryUserId: beneficiary === "MEMBER" && beneficiaryUserId ? beneficiaryUserId : null,
        placeId: pid ?? null,
      };
      const res = await fetch(editingId ? `/api/expenses/${editingId}` : "/api/expenses", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) {
        setError((d.error as string) ?? "Ошибка");
        return;
      }
      router.refresh();
      setShowForm(false);
      setEditingId(null);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить расход?")) return;
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (res.ok) {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      router.refresh();
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-slate-900 dark:text-white text-2xl font-bold">Расходы семьи</h1>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors min-h-11 sm:min-h-0"
        >
          <Plus className="w-4 h-4" />
          Ввести расход
        </button>
      </div>

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
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
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
                let yBottom = chartH;
                const segments: { cat: string; h: number }[] = [];
                if (m.total > 0 && h > 0) {
                  for (const cat of CATEGORY_STACK_ORDER) {
                    const amt = m.byCategory[cat];
                    if (!amt || amt <= 0) continue;
                    const segH = (amt / m.total) * h;
                    segments.push({ cat, h: segH });
                  }
                }
                return (
                  <g key={m.label + i}>
                    {segments.length === 0 ? (
                      <rect
                        x={x}
                        y={chartH - h}
                        width={barW}
                        height={Math.max(h, 0)}
                        rx={2}
                        fill="#6366f1"
                        opacity={0.85}
                      />
                    ) : (
                      segments.map(({ cat, h: segH }) => {
                        yBottom -= segH;
                        return (
                          <rect
                            key={cat}
                            x={x}
                            y={yBottom}
                            width={barW}
                            height={Math.max(segH, 0)}
                            rx={0}
                            fill={CATEGORY_BAR_FILL[cat] ?? "#64748b"}
                            opacity={0.92}
                          />
                        );
                      })
                    )}
                    {segments.length > 0 && (
                      <rect
                        x={x}
                        y={chartH - h}
                        width={barW}
                        height={Math.max(h, 0)}
                        rx={2}
                        fill="none"
                        stroke="rgba(148,163,184,0.35)"
                        strokeWidth={1}
                      />
                    )}
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

        <div className="lg:col-span-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <p>Нет расходов за выбранный период</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((e) => {
                const canEdit = e.author.id === currentUserId || isAdmin;
                return (
                  <div
                    key={e.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex items-start gap-3 shadow-sm dark:shadow-none"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-slate-900 dark:text-white text-sm font-medium">{e.title}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", CATEGORY_COLORS[e.category])}>
                          {EXPENSE_CATEGORY_LABELS[e.category]}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-slate-500">
                        <span>{format(new Date(e.date), "d MMM yyyy", { locale: ru })}</span>
                        <span>·</span>
                        <span>{e.author.name ?? e.author.id}</span>
                        {e.beneficiary === "FAMILY" ? (
                          <span className="text-slate-600">· на семью</span>
                        ) : e.beneficiaryUser ? (
                          <span className="text-slate-600">· на {e.beneficiaryUser.name ?? e.beneficiaryUser.id}</span>
                        ) : null}
                        {e.place && <span className="text-slate-600">· {e.place.name}</span>}
                        {e.note && <span className="text-slate-600 truncate">· {e.note}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-slate-900 dark:text-white font-semibold text-sm">
                        {formatMoney(e.amount, e.currency)}
                      </span>
                      {canEdit && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(e)}
                            className="p-1 rounded text-slate-500 hover:text-indigo-500"
                            title="Изменить"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(e.id)}
                            className="p-1 rounded text-slate-500 hover:text-red-500"
                            title="Удалить"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between gap-2 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-slate-900 dark:text-white font-semibold text-lg">
                {editingId ? "Редактировать расход" : "Новый расход"}
              </h2>
              <div className="flex items-center gap-1">
                {!editingId && (
                  <button
                    type="button"
                    onClick={() => setShowQrScanner(true)}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 min-h-11 sm:min-h-0"
                    title="Сканировать QR чека"
                  >
                    <QrCode className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">QR чека</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white min-h-11 min-w-11 flex items-center justify-center sm:min-h-0 sm:min-w-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <form onSubmit={(ev) => void handleSubmit(ev)} className="p-6 space-y-4">
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
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">На кого расход</label>
                <select
                  value={beneficiary}
                  onChange={(e) => setBeneficiary(e.target.value as "FAMILY" | "MEMBER")}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="FAMILY">Семья</option>
                  <option value="MEMBER">Конкретный участник</option>
                </select>
              </div>
              {beneficiary === "MEMBER" && (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Участник</label>
                  <select
                    value={beneficiaryUserId}
                    onChange={(e) => setBeneficiaryUserId(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Выберите</option>
                    {familyUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.name ?? u.id}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Место</label>
                <select
                  value={placeId}
                  onChange={(e) => setPlaceId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                >
                  <option value="">Не указано</option>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input
                  value={newPlaceName}
                  onChange={(e) => setNewPlaceName(e.target.value)}
                  placeholder="Новое место в справочнике…"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
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
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="flex-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 font-medium rounded-lg px-4 py-2.5 transition-colors text-sm min-h-11 sm:min-h-0"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={cn("flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-4 py-2.5 transition-colors text-sm", loading && "opacity-60 cursor-not-allowed")}
                >
                  {loading ? "Сохранение…" : editingId ? "Сохранить" : "Добавить"}
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
