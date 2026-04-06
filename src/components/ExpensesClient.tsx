"use client";

import dynamic from "next/dynamic";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Plus, X, Wallet, QrCode, Pencil, Trash2, ImagePlus, Camera, ScanLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn, formatMoney, EXPENSE_CATEGORY_LABELS } from "@/lib/utils";
import { addExpenseToCategoryBuckets } from "@/lib/expense-category-aggregation";
import { categoryBarFillForCode, sortCategoryCodesForStack } from "@/lib/expense-category-visual";
import { compressImageFileForReceiptUpload } from "@/lib/compress-receipt-image-client";

type ExpenseReceiptLineRow = {
  id: string;
  title: string;
  amount: number;
  category: string;
  sortOrder: number;
};

type Expense = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  note: string | null;
  imageUrl: string | null;
  receiptImageUrl: string | null;
  beneficiary: string;
  beneficiaryUserId: string | null;
  placeId: string | null;
  author: { id: string; name: string | null; avatarUrl: string | null };
  beneficiaryUser: { id: string; name: string | null } | null;
  place: { id: string; name: string } | null;
  receiptLines: ExpenseReceiptLineRow[];
};

type UserOpt = { id: string; name: string | null };

const ReceiptQrScanner = dynamic(() => import("./ReceiptQrScanner"), { ssr: false });

function receiptPhotoUploadErrorMessage(res: Response, raw: string): string {
  if (res.status === 413 || /413|Request Entity Too Large|Entity Too Large/i.test(raw)) {
    return "Снимок слишком большой для прокси (nginx). Повторите отправку — фото ужимается перед загрузкой. Если снова ошибка, админу: увеличить client_max_body_size.";
  }
  const t = raw.trim();
  if (t.startsWith("<") || t.includes("<html")) {
    return `Ошибка сервера (HTTP ${res.status}). Попробуйте другой снимок или позже.`;
  }
  try {
    const d = JSON.parse(raw) as { error?: string; message?: string };
    return d.error ?? d.message ?? `Ошибка сервера (HTTP ${res.status})`;
  } catch {
    return raw.length > 280 ? `${raw.slice(0, 280)}…` : raw || `Ошибка сервера (HTTP ${res.status})`;
  }
}

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
  UNRECOGNIZED: "bg-zinc-500/20 text-zinc-400",
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
  UNRECOGNIZED: "#71717a",
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
  const [tabscannerBusy, setTabscannerBusy] = useState(false);
  const tabscannerFileInputRef = useRef<HTMLInputElement>(null);
  const [receiptQrUploadError, setReceiptQrUploadError] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<{ code: string; label: string }[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState<"" | "img" | "receipt">("");
  const [spreadBusy, setSpreadBusy] = useState(false);
  const [formReceiptLines, setFormReceiptLines] = useState<ExpenseReceiptLineRow[]>([]);
  const [showTrainWizard, setShowTrainWizard] = useState(false);
  const [trainMode, setTrainMode] = useState<"lines" | "parent">("lines");
  const [trainQueue, setTrainQueue] = useState<ExpenseReceiptLineRow[]>([]);
  const [trainStep, setTrainStep] = useState(0);
  const [trainCategorySelect, setTrainCategorySelect] = useState("FOOD");
  const [trainAccum, setTrainAccum] = useState<Record<string, string>>({});
  const [trainBusy, setTrainBusy] = useState(false);
  const resumeExpenseFormAfterQr = useRef(false);
  const imgExpenseInputRef = useRef<HTMLInputElement>(null);
  const receiptCameraInputRef = useRef<HTMLInputElement>(null);
  const receiptGalleryInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [adminCategoryRows, setAdminCategoryRows] = useState<Array<{ id: string; code: string; label: string }>>([]);
  const [newCatCode, setNewCatCode] = useState("");
  const [newCatLabel, setNewCatLabel] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editCategoryLabel, setEditCategoryLabel] = useState("");
  const [adminCatBusy, setAdminCatBusy] = useState(false);

  const isAdmin = currentUserRole === "ADMIN" || currentUserRole === "SUPERADMIN";

  const categoryLabel = useMemo(() => {
    const m: Record<string, string> = { ...EXPENSE_CATEGORY_LABELS };
    for (const c of categoryOptions) m[c.code] = c.label;
    return m;
  }, [categoryOptions]);

  /** Пары [code, label] для фильтра и формы — из БД или запасной словарь */
  const categoryPairs = useMemo((): [string, string][] => {
    if (categoryOptions.length > 0) {
      return categoryOptions.map((c) => [c.code, c.label]);
    }
    return Object.entries(EXPENSE_CATEGORY_LABELS) as [string, string][];
  }, [categoryOptions]);

  const trainCategoryPairs = useMemo(
    () => categoryPairs.filter(([code]) => code !== "UNRECOGNIZED"),
    [categoryPairs]
  );

  /** Порядок сегментов в графике: базовые цвета, затем категории из БД по порядку справочника. */
  const categoryStackPriority = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of CATEGORY_STACK_ORDER) {
      if (!seen.has(c)) {
        out.push(c);
        seen.add(c);
      }
    }
    for (const c of categoryOptions) {
      if (!seen.has(c.code)) {
        out.push(c.code);
        seen.add(c.code);
      }
    }
    return out;
  }, [categoryOptions]);

  const refreshCategoryOptions = useCallback(async () => {
    try {
      const cRes = await fetch("/api/expense-categories");
      if (cRes.ok) {
        const j = (await cRes.json()) as { categories: { code: string; label: string }[] };
        setCategoryOptions(j.categories);
      }
      if (isAdmin) {
        const aRes = await fetch("/api/admin/expense-categories");
        if (aRes.ok) {
          const j = (await aRes.json()) as { categories: { id: string; code: string; label: string }[] };
          setAdminCategoryRows(j.categories);
        }
      }
    } catch {
      /* ignore */
    }
  }, [isAdmin]);

  useEffect(() => {
    setExpenses(initialExpenses);
  }, [initialExpenses]);

  useEffect(() => {
    void (async () => {
      try {
        const [uRes, pRes] = await Promise.all([fetch("/api/users"), fetch("/api/expense-places")]);
        if (uRes.ok) {
          const list = (await uRes.json()) as UserOpt[];
          setFamilyUsers(list);
        }
        if (pRes.ok) setPlaces(await pRes.json());
        await refreshCategoryOptions();
      } catch {
        /* ignore */
      }
    })();
  }, [refreshCategoryOptions]);

  useEffect(() => {
    if (!attachMenuOpen) return;
    function onDoc(ev: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(ev.target as Node)) {
        setAttachMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [attachMenuOpen]);

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
    setImageUrl(null);
    setReceiptImageUrl(null);
    setFormReceiptLines([]);
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
    setImageUrl(e.imageUrl ?? null);
    setReceiptImageUrl(e.receiptImageUrl ?? null);
    setFormReceiptLines(e.receiptLines);
    setError("");
    setShowForm(true);
  }

  async function uploadExpenseImage(f: File | null) {
    if (!f) return;
    setUploadBusy("img");
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/upload/expense-image", { method: "POST", body: fd });
      const d = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setError(d.error ?? "Не удалось загрузить фото");
        return;
      }
      if (d.url) setImageUrl(d.url);
    } finally {
      setUploadBusy("");
    }
  }

  async function uploadReceiptImage(f: File | null) {
    if (!f) return;
    setUploadBusy("receipt");
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/upload/expense-receipt", { method: "POST", body: fd });
      const d = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setError(d.error ?? "Не удалось обработать чек");
        return;
      }
      if (d.url) setReceiptImageUrl(d.url);
    } finally {
      setUploadBusy("");
    }
  }

  const filtered = useMemo(() => {
    let list = expenses;
    if (filterCategory) {
      list = list.filter(
        (e) =>
          e.category === filterCategory ||
          e.receiptLines.some((r) => r.category === filterCategory)
      );
    }
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
      addExpenseToCategoryBuckets(map, e);
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

  const importFromReceiptQrRaw = useCallback(
    async (qrraw: string) => {
      if (!qrraw.trim()) return;
      setReceiptQrUploadError("");
      setError("");
      try {
        setLoading(true);
        const res = await fetch("/api/expenses/from-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrraw }),
        });
        const raw = await res.text();
        if (!res.ok) {
          const msg = receiptPhotoUploadErrorMessage(res, raw);
          setError(msg);
          setReceiptQrUploadError(msg);
          return;
        }
        resumeExpenseFormAfterQr.current = false;
        setShowQrScanner(false);
        setShowForm(false);
        router.refresh();
      } catch {
        const msg = "Ошибка соединения";
        setError(msg);
        setReceiptQrUploadError(msg);
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  const importFromReceiptOcr = useCallback(
    async (file: File | null) => {
      if (!file?.size) return;
      setReceiptQrUploadError("");
      if (file.size > 32 * 1024 * 1024) {
        const msg = "Файл больше 32 МБ";
        setError(msg);
        setReceiptQrUploadError(msg);
        return;
      }
      setError("");
      try {
        const compressed = await compressImageFileForReceiptUpload(file);
        if (compressed.size > 32 * 1024 * 1024) {
          const msg = "После сжатия файл всё ещё больше 32 МБ — снимите чек ближе или с меньшим разрешением.";
          setError(msg);
          setReceiptQrUploadError(msg);
          return;
        }
        setTabscannerBusy(true);
        const fd = new FormData();
        fd.append("file", compressed);
        const res = await fetch("/api/expenses/from-receipt-ocr", { method: "POST", body: fd });
        const raw = await res.text();
        if (!res.ok) {
          const msg = receiptPhotoUploadErrorMessage(res, raw);
          setError(msg);
          setReceiptQrUploadError(msg);
          return;
        }
        setShowForm(false);
        router.refresh();
      } catch {
        const msg = "Ошибка соединения";
        setError(msg);
        setReceiptQrUploadError(msg);
      } finally {
        setTabscannerBusy(false);
      }
    },
    [router]
  );

  const importFromReceiptPhoto = useCallback(
    async (file: File | null) => {
      if (!file?.size) return;
      setReceiptQrUploadError("");
      if (file.size > 32 * 1024 * 1024) {
        const msg = "Файл больше 32 МБ";
        setError(msg);
        setReceiptQrUploadError(msg);
        return;
      }
      setError("");
      try {
        const compressed = await compressImageFileForReceiptUpload(file);
        if (compressed.size > 32 * 1024 * 1024) {
          const msg = "После сжатия файл всё ещё больше 32 МБ — снимите чек ближе или с меньшим разрешением.";
          setError(msg);
          setReceiptQrUploadError(msg);
          return;
        }
        setLoading(true);
        const fd = new FormData();
        fd.append("file", compressed);
        const res = await fetch("/api/expenses/from-receipt", { method: "POST", body: fd });
        const raw = await res.text();
        if (!res.ok) {
          const msg = receiptPhotoUploadErrorMessage(res, raw);
          setError(msg);
          setReceiptQrUploadError(msg);
          return;
        }
        resumeExpenseFormAfterQr.current = false;
        setShowQrScanner(false);
        setShowForm(false);
        router.refresh();
      } catch {
        const msg = "Ошибка соединения";
        setError(msg);
        setReceiptQrUploadError(msg);
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

  async function spreadCategories() {
    if (!editingId) return;
    setSpreadBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/expenses/${editingId}/spread-categories`, { method: "POST" });
      const raw = await res.text();
      let d: Record<string, unknown>;
      try {
        d = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        setError("Некорректный ответ сервера");
        return;
      }
      if (!res.ok) {
        setError((d.error as string) ?? "Не удалось разнести по категориям");
        return;
      }
      const cat = String(d.category ?? "");
      setCategory(cat);
      setPlaceId((d.placeId as string | null | undefined) ?? "");
      const pl = d.place as { id: string; name: string } | null | undefined;
      if (pl?.id) {
        setPlaces((prev) =>
          prev.some((p) => p.id === pl.id) ? prev : [...prev, pl].sort((a, b) => a.name.localeCompare(b.name))
        );
      }
      const lines = (d.receiptLines as Array<Record<string, unknown>> | undefined) ?? [];
      const normalizedLines: ExpenseReceiptLineRow[] = lines.map((r) => ({
        id: String(r.id),
        title: String(r.title),
        amount: Number(r.amount),
        category: String(r.category),
        sortOrder: Number(r.sortOrder),
      }));
      setFormReceiptLines(normalizedLines.length ? normalizedLines : []);
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === editingId
            ? {
                ...e,
                category: cat,
                placeId: (d.placeId as string | null | undefined) ?? null,
                place: pl ?? null,
                receiptLines: normalizedLines.length ? normalizedLines : e.receiptLines,
              }
            : e
        )
      );
      router.refresh();
    } catch {
      setError("Ошибка соединения");
    } finally {
      setSpreadBusy(false);
    }
  }

  function closeTrainWizard() {
    setShowTrainWizard(false);
    setTrainQueue([]);
    setTrainStep(0);
    setTrainAccum({});
    setTrainBusy(false);
  }

  async function submitNewAdminCategory() {
    if (!newCatCode.trim() || !newCatLabel.trim()) return;
    setAdminCatBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/expense-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: newCatCode, label: newCatLabel }),
      });
      const d = (await res.json()) as { code?: string; error?: string };
      if (!res.ok) {
        setError(d.error ?? "Не удалось добавить категорию");
        return;
      }
      setNewCatCode("");
      setNewCatLabel("");
      await refreshCategoryOptions();
      if (d.code) setTrainCategorySelect(d.code);
    } finally {
      setAdminCatBusy(false);
    }
  }

  async function submitEditAdminCategory() {
    if (!editCategoryId) return;
    setAdminCatBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/expense-categories/${editCategoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editCategoryLabel }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(d.error ?? "Не удалось сохранить");
        return;
      }
      setEditCategoryId("");
      setEditCategoryLabel("");
      await refreshCategoryOptions();
    } finally {
      setAdminCatBusy(false);
    }
  }

  function renderTrainAdminCategoryBlock() {
    if (!isAdmin) return null;
    return (
      <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3 space-y-3">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Категории (админ)</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="w-[min(100%,7rem)]">
            <label className="block text-[11px] text-slate-500 mb-0.5">Код</label>
            <input
              type="text"
              value={newCatCode}
              onChange={(e) => setNewCatCode(e.target.value)}
              placeholder="Напр. AUTO"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs uppercase"
            />
          </div>
          <div className="flex-1 min-w-[8rem]">
            <label className="block text-[11px] text-slate-500 mb-0.5">Название</label>
            <input
              type="text"
              value={newCatLabel}
              onChange={(e) => setNewCatLabel(e.target.value)}
              placeholder="Подпись в списке"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs"
            />
          </div>
          <button
            type="button"
            disabled={adminCatBusy || !newCatCode.trim() || !newCatLabel.trim()}
            onClick={() => void submitNewAdminCategory()}
            className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 text-xs font-medium text-emerald-900 dark:text-emerald-200 disabled:opacity-50"
          >
            Добавить
          </button>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[10rem]">
            <label className="block text-[11px] text-slate-500 mb-0.5">Переименовать</label>
            <select
              value={editCategoryId}
              onChange={(e) => {
                const id = e.target.value;
                setEditCategoryId(id);
                const row = adminCategoryRows.find((r) => r.id === id);
                setEditCategoryLabel(row?.label ?? "");
              }}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs"
            >
              <option value="">— выберите категорию —</option>
              {adminCategoryRows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[8rem]">
            <label className="block text-[11px] text-slate-500 mb-0.5">Новое название</label>
            <input
              type="text"
              value={editCategoryLabel}
              onChange={(e) => setEditCategoryLabel(e.target.value)}
              disabled={!editCategoryId}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs disabled:opacity-50"
            />
          </div>
          <button
            type="button"
            disabled={adminCatBusy || !editCategoryId || !editCategoryLabel.trim()}
            onClick={() => void submitEditAdminCategory()}
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      </div>
    );
  }

  function openTrainWizard() {
    if (!editingId) return;
    setError("");
    const ed = expenses.find((e) => e.id === editingId);
    if (!ed) return;
    const q = formReceiptLines.filter((r) => r.category === "UNRECOGNIZED");
    if (ed.receiptLines.length === 0 && ed.category === "UNRECOGNIZED") {
      setTrainMode("parent");
      setTrainCategorySelect(trainCategoryPairs[0]?.[0] ?? "FOOD");
      setShowTrainWizard(true);
      if (isAdmin) void refreshCategoryOptions();
      return;
    }
    if (q.length === 0) {
      setError("Нет позиций с категорией «Не распознано». Сначала разнесите по категориям или добавьте чек.");
      return;
    }
    setTrainMode("lines");
    setTrainQueue(q);
    setTrainStep(0);
    setTrainAccum({});
    setTrainCategorySelect(trainCategoryPairs[0]?.[0] ?? "FOOD");
    setShowTrainWizard(true);
    if (isAdmin) void refreshCategoryOptions();
  }

  async function submitTrainWizardFinal(acc: Record<string, string>) {
    if (!editingId) return;
    setTrainBusy(true);
    setError("");
    try {
      const choices = trainQueue.map((l) => ({
        receiptLineId: l.id,
        categoryCode: acc[l.id]!,
      }));
      const res = await fetch(`/api/expenses/${editingId}/confirm-hints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choices }),
      });
      const raw = await res.text();
      let d: Record<string, unknown>;
      try {
        d = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        setError("Некорректный ответ сервера");
        return;
      }
      if (!res.ok) {
        setError((d.error as string) ?? "Не удалось сохранить");
        return;
      }
      const cat = String(d.category ?? "");
      setCategory(cat);
      const lines = (d.receiptLines as Array<Record<string, unknown>> | undefined) ?? [];
      const normalizedLines: ExpenseReceiptLineRow[] = lines.map((r) => ({
        id: String(r.id),
        title: String(r.title),
        amount: Number(r.amount),
        category: String(r.category),
        sortOrder: Number(r.sortOrder),
      }));
      setFormReceiptLines(normalizedLines);
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === editingId
            ? {
                ...e,
                category: cat,
                receiptLines: normalizedLines.length ? normalizedLines : e.receiptLines,
              }
            : e
        )
      );
      closeTrainWizard();
      router.refresh();
    } catch {
      setError("Ошибка соединения");
    } finally {
      setTrainBusy(false);
    }
  }

  async function submitParentCategoryTrain() {
    if (!editingId) return;
    setTrainBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/expenses/${editingId}/confirm-hints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentCategoryOnly: trainCategorySelect }),
      });
      const raw = await res.text();
      let d: Record<string, unknown>;
      try {
        d = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        setError("Некорректный ответ сервера");
        return;
      }
      if (!res.ok) {
        setError((d.error as string) ?? "Не удалось сохранить");
        return;
      }
      const cat = String(d.category ?? "");
      setCategory(cat);
      setExpenses((prev) =>
        prev.map((e) => (e.id === editingId ? { ...e, category: cat } : e))
      );
      closeTrainWizard();
      router.refresh();
    } catch {
      setError("Ошибка соединения");
    } finally {
      setTrainBusy(false);
    }
  }

  function trainGoNext() {
    const line = trainQueue[trainStep];
    if (!line) return;
    const nextAcc = { ...trainAccum, [line.id]: trainCategorySelect };
    setTrainAccum(nextAcc);
    if (trainStep >= trainQueue.length - 1) {
      void submitTrainWizardFinal(nextAcc);
      return;
    }
    const nextStep = trainStep + 1;
    setTrainStep(nextStep);
    const nl = trainQueue[nextStep]!;
    setTrainCategorySelect(nextAcc[nl.id] ?? trainCategoryPairs[0]?.[0] ?? "FOOD");
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
        imageUrl: imageUrl ?? undefined,
        receiptImageUrl: receiptImageUrl ?? undefined,
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
          {categoryPairs.map(([val, label]) => (
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
                  const catsInMonth = Object.entries(m.byCategory)
                    .filter(([, amt]) => amt != null && amt > 0)
                    .map(([c]) => c);
                  const ordered = sortCategoryCodesForStack(catsInMonth, categoryStackPriority);
                  for (const cat of ordered) {
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
                            fill={categoryBarFillForCode(cat, CATEGORY_BAR_FILL)}
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
                      <span className="text-slate-500 dark:text-slate-400">{categoryLabel[cat] ?? cat}</span>
                      <span className="text-slate-900 dark:text-white">{formatMoney(sum)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(sum / maxCat) * 100}%`,
                          backgroundColor: categoryBarFillForCode(cat, CATEGORY_BAR_FILL),
                        }}
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
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", CATEGORY_COLORS[e.category] ?? "bg-slate-500/20 text-slate-400")}>
                          {categoryLabel[e.category] ?? e.category}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-slate-500">
                        {(e.imageUrl || e.receiptImageUrl) && (
                          <span className="flex gap-1 shrink-0">
                            {e.imageUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={e.imageUrl} alt="" className="h-11 w-11 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
                            )}
                            {e.receiptImageUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={e.receiptImageUrl}
                                alt="Чек"
                                className="h-11 w-11 rounded-lg object-cover border border-slate-600 grayscale"
                              />
                            )}
                          </span>
                        )}
                        <span>{format(new Date(e.date), "d MMM yyyy", { locale: ru })}</span>
                        <span>·</span>
                        <span>{e.author.name ?? e.author.id}</span>
                        {e.beneficiary === "FAMILY" ? (
                          <span className="text-slate-600">· на семью</span>
                        ) : e.beneficiaryUser ? (
                          <span className="text-slate-600">· на {e.beneficiaryUser.name ?? e.beneficiaryUser.id}</span>
                        ) : null}
                        {e.place && <span className="text-slate-600">· {e.place.name}</span>}
                        {e.note && (
                          <span className="text-slate-600 line-clamp-2" title={e.note ?? undefined}>
                            · {e.note}
                          </span>
                        )}
                      </div>
                      {e.receiptLines.length > 0 && (
                        <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden max-h-52 overflow-y-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="sticky top-0 z-[1] bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                              <tr>
                                <th className="px-2 py-1.5 font-medium text-slate-600 dark:text-slate-400">Позиция</th>
                                <th className="px-2 py-1.5 font-medium text-slate-600 dark:text-slate-400 w-[6.5rem]">
                                  Категория
                                </th>
                                <th className="px-2 py-1.5 font-medium text-right text-slate-600 dark:text-slate-400 w-[7rem]">
                                  Сумма
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {e.receiptLines.map((r) => (
                                <tr
                                  key={r.id}
                                  className="border-t border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                                >
                                  <td className="px-2 py-1 text-slate-800 dark:text-slate-200 align-top">{r.title}</td>
                                  <td className="px-2 py-1 text-slate-600 dark:text-slate-400 align-top text-[11px] leading-snug">
                                    {categoryLabel[r.category] ?? r.category}
                                  </td>
                                  <td className="px-2 py-1 text-right tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                    {formatMoney(r.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
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
                  <>
                    <input
                      ref={tabscannerFileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={tabscannerBusy || loading}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        e.target.value = "";
                        void importFromReceiptOcr(f);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptQrUploadError("");
                        tabscannerFileInputRef.current?.click();
                      }}
                      disabled={tabscannerBusy || loading}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 min-h-11 sm:min-h-0",
                        (tabscannerBusy || loading) && "opacity-60 cursor-not-allowed"
                      )}
                      title="OCR чека без QR (Tabscanner): снимите чек целиком"
                    >
                      <ScanLine className="h-4 w-4 shrink-0" />
                      <span className="hidden sm:inline">{tabscannerBusy ? "Скан…" : "Скан чека"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptQrUploadError("");
                        resumeExpenseFormAfterQr.current = true;
                        setShowForm(false);
                        setShowQrScanner(true);
                      }}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 min-h-11 sm:min-h-0"
                      title="Сканировать QR чека (камера или галерея)"
                    >
                      <QrCode className="h-4 w-4 shrink-0" />
                      <span className="hidden sm:inline">QR чека</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setFormReceiptLines([]);
                    closeTrainWizard();
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
                  {categoryPairs.map(([val, label]) => (
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

              {editingId && formReceiptLines.length > 0 && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 px-3 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    Позиции чека
                  </p>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/95">
                        <tr>
                          <th className="px-2 py-1.5 font-medium text-slate-600 dark:text-slate-400">Позиция</th>
                          <th className="px-2 py-1.5 font-medium text-slate-600 dark:text-slate-400 w-[6.5rem]">Категория</th>
                          <th className="px-2 py-1.5 font-medium text-right text-slate-600 dark:text-slate-400 w-[5.5rem]">Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formReceiptLines.map((r) => (
                          <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-2 py-1 text-slate-800 dark:text-slate-200 align-top">{r.title}</td>
                            <td className="px-2 py-1 text-slate-600 dark:text-slate-400 align-top leading-snug">
                              {categoryLabel[r.category] ?? r.category}
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              {formatMoney(r.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {editingId && category === "UNRECOGNIZED" && (
                <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/40 p-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                    Разнести позиции по категориям (ИИ) и заполнить «Место» из продавца в заметке, если он указан.
                  </p>
                  <button
                    type="button"
                    onClick={() => void spreadCategories()}
                    disabled={spreadBusy || loading}
                    className={cn(
                      "w-full rounded-lg border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-medium text-indigo-800 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/80",
                      (spreadBusy || loading) && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    {spreadBusy ? "Разнесение…" : "Разнести по категориям"}
                  </button>
                </div>
              )}

              {editingId &&
                (category === "UNRECOGNIZED" || formReceiptLines.some((r) => r.category === "UNRECOGNIZED")) && (
                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 p-3">
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                      Уточните категории вручную по одной позиции — примеры сохраняются для ИИ (справочник смыслов).
                    </p>
                    <button
                      type="button"
                      onClick={() => openTrainWizard()}
                      disabled={trainBusy || loading}
                      className={cn(
                        "w-full rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-medium text-emerald-900 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/80",
                        (trainBusy || loading) && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      Уточнить пошагово (обучение)
                    </button>
                  </div>
                )}

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-3">
                <div className="flex items-start gap-2">
                  <div className="flex flex-wrap gap-1.5 items-center flex-1 min-w-0 min-h-[2.25rem]">
                    {imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt=""
                        className="h-10 w-10 rounded-md object-cover border border-slate-200 dark:border-slate-600 shrink-0"
                      />
                    )}
                    {receiptImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={receiptImageUrl}
                        alt="Чек"
                        className="h-10 w-10 rounded-md object-cover border border-slate-600 grayscale shrink-0"
                      />
                    )}
                    {!imageUrl && !receiptImageUrl && (
                      <span className="text-[11px] text-slate-500">Нет вложений</span>
                    )}
                  </div>
                  <div className="relative shrink-0" ref={attachMenuRef}>
                    <button
                      type="button"
                      onClick={() => setAttachMenuOpen((o) => !o)}
                      disabled={uploadBusy !== ""}
                      title="Добавить вложение"
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
                        uploadBusy !== "" && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    {attachMenuOpen && (
                      <div className="absolute right-0 bottom-full z-20 mb-1 min-w-[12rem] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 py-1 shadow-lg">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            imgExpenseInputRef.current?.click();
                          }}
                        >
                          <ImagePlus className="w-4 h-4 shrink-0" />
                          Фото к расходу
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            receiptCameraInputRef.current?.click();
                          }}
                        >
                          <Camera className="w-4 h-4 shrink-0" />
                          Снять чек
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            receiptGalleryInputRef.current?.click();
                          }}
                        >
                          <ImagePlus className="w-4 h-4 shrink-0" />
                          Чек из галереи
                        </button>
                        <p className="px-3 pb-1.5 pt-0 text-[10px] text-slate-500">Чек на сервере сжимается до ~100 КБ</p>
                      </div>
                    )}
                  </div>
                </div>
                <input
                  ref={imgExpenseInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadBusy !== ""}
                  onChange={(e) => void uploadExpenseImage(e.target.files?.[0] ?? null)}
                />
                <input
                  ref={receiptCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={uploadBusy !== ""}
                  onChange={(e) => void uploadReceiptImage(e.target.files?.[0] ?? null)}
                />
                <input
                  ref={receiptGalleryInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadBusy !== ""}
                  onChange={(e) => void uploadReceiptImage(e.target.files?.[0] ?? null)}
                />
                {uploadBusy && (
                  <p className="mt-2 text-xs text-slate-500">Загрузка ({uploadBusy === "img" ? "фото" : "чек"})…</p>
                )}
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
                    setFormReceiptLines([]);
                    closeTrainWizard();
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

      {showTrainWizard && editingId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-slate-900 dark:text-white font-semibold text-lg">
                {trainMode === "parent" ? "Категория расхода" : "Уточнение категории"}
              </h3>
              <button
                type="button"
                onClick={() => closeTrainWizard()}
                className="text-slate-500 hover:text-slate-900 dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {trainMode === "parent" ? (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Для этого расхода нет строк чека. Выберите категорию — она сохранится в справочнике обучения по названию
                  расхода.
                </p>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Категория</label>
                  <select
                    value={trainCategorySelect}
                    onChange={(e) => setTrainCategorySelect(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm"
                  >
                    {trainCategoryPairs.map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {renderTrainAdminCategoryBlock()}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => closeTrainWizard()}
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 py-2.5 text-sm"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    disabled={trainBusy}
                    onClick={() => void submitParentCategoryTrain()}
                    className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 text-sm font-medium disabled:opacity-60"
                  >
                    {trainBusy ? "Сохранение…" : "Сохранить"}
                  </button>
                </div>
              </>
            ) : (
              (() => {
                const cur = trainQueue[trainStep];
                if (!cur) return null;
                return (
                  <>
                    <p className="text-xs text-slate-500">
                      Вопрос {trainStep + 1} из {trainQueue.length}
                    </p>
                    <p className="text-slate-900 dark:text-white font-medium text-sm leading-snug">{cur.title}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{formatMoney(cur.amount)}</p>
                    <p className="text-xs text-slate-500">
                      В какую категорию отнести эту позицию? Ответ попадёт в справочник для следующих чеков.
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Категория</label>
                      <select
                        value={trainCategorySelect}
                        onChange={(e) => setTrainCategorySelect(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm"
                      >
                        {trainCategoryPairs.map(([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {renderTrainAdminCategoryBlock()}
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => closeTrainWizard()}
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 py-2.5 text-sm"
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        disabled={trainBusy}
                        onClick={() => trainGoNext()}
                        className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 text-sm font-medium disabled:opacity-60"
                      >
                        {trainBusy
                          ? "Сохранение…"
                          : trainStep >= trainQueue.length - 1
                            ? "Сохранить и обучить"
                            : "Далее"}
                      </button>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}

      {showQrScanner && (
        <ReceiptQrScanner
          onDecodedQrRaw={(q) => void importFromReceiptQrRaw(q)}
          onReceiptPhoto={(f) => void importFromReceiptPhoto(f)}
          receiptPhotoBusy={loading}
          serverUploadError={receiptQrUploadError}
          onClose={() => {
            setReceiptQrUploadError("");
            setShowQrScanner(false);
            if (resumeExpenseFormAfterQr.current) {
              resumeExpenseFormAfterQr.current = false;
              setShowForm(true);
            }
          }}
        />
      )}
    </div>
  );
}
