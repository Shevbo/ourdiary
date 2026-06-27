import { prisma } from "@/lib/prisma";
import {
  addDays,
  endOfWeek,
  startOfWeek,
  startOfDay,
  endOfDay,
} from "date-fns";

export type TvView = "month" | "week" | "feed";

export function normalizeView(raw: string | null | undefined): TvView {
  return raw === "week" || raw === "feed" ? raw : "month";
}

/** Диапазон [from, to] для выбранного вида относительно anchor. */
export function computeRange(view: TvView, anchor: Date): { from: Date; to: Date } {
  if (view === "week") {
    return {
      from: startOfWeek(anchor, { weekStartsOn: 1 }),
      to: endOfWeek(anchor, { weekStartsOn: 1 }),
    };
  }
  if (view === "feed") {
    return { from: startOfDay(addDays(anchor, -7)), to: endOfDay(addDays(anchor, 60)) };
  }
  // month
  const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

export type TvCategory = { name: string; color: string; icon: string | null };

export type NumberedEvent = {
  n: number;
  id: string;
  title: string;
  description: string | null;
  type: string;
  date: string;
  category: TvCategory | null;
  authorName: string | null;
};

export type SnapshotItem = {
  n: number;
  id: string;
  title: string;
  type: string;
  date: string;
  categoryName: string | null;
  categoryColor: string | null;
};

export type NumberedResult = {
  view: TvView;
  anchor: string;
  from: string;
  to: string;
  events: NumberedEvent[];
};

/**
 * Возвращает события диапазона со сквозной нумерацией n=1..N (date asc)
 * и одновременно сохраняет снимок в TvViewState(id="tv") — чтобы голосовая
 * ссылка «событие N» совпадала с тем, что показано на экране.
 */
export async function getNumberedEvents(view: TvView, anchor: Date): Promise<NumberedResult> {
  const { from, to } = computeRange(view, anchor);

  const rows = await prisma.event.findMany({
    where: { status: "ACTIVE", date: { gte: from, lte: to } },
    include: {
      category: { select: { name: true, color: true, icon: true } },
      author: { select: { name: true } },
    },
    orderBy: { date: "asc" },
  });

  type Row = (typeof rows)[number];

  const events: NumberedEvent[] = rows.map((e: Row, i: number) => ({
    n: i + 1,
    id: e.id,
    title: e.title,
    description: e.description,
    type: e.type,
    date: e.date.toISOString(),
    category: e.category
      ? { name: e.category.name, color: e.category.color, icon: e.category.icon }
      : null,
    authorName: e.author?.name ?? null,
  }));

  const snapshot: SnapshotItem[] = events.map((e) => ({
    n: e.n,
    id: e.id,
    title: e.title,
    type: e.type,
    date: e.date,
    categoryName: e.category?.name ?? null,
    categoryColor: e.category?.color ?? null,
  }));

  await prisma.tvViewState.upsert({
    where: { id: "tv" },
    update: { view, anchor, snapshot },
    create: { id: "tv", view, anchor, snapshot },
  });

  return {
    view,
    anchor: anchor.toISOString(),
    from: from.toISOString(),
    to: to.toISOString(),
    events,
  };
}

const DEFAULT_CATEGORY_COLOR = "#64748b";

/**
 * Находит категорию по имени без учёта регистра; создаёт новую с цветом
 * по умолчанию и следующим order, если её нет. Возвращает id категории.
 */
export async function findOrCreateCategoryByName(name: string): Promise<string> {
  const trimmed = name.trim();
  const existing = await prisma.category.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const max = await prisma.category.aggregate({ _max: { order: true } });
  const nextOrder = (max._max.order ?? 0) + 1;

  const created = await prisma.category.create({
    data: { name: trimmed, color: DEFAULT_CATEGORY_COLOR, order: nextOrder },
    select: { id: true },
  });
  return created.id;
}
