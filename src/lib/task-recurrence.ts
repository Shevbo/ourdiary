import type { TaskRecurrenceKind } from "@prisma/client";

/** Следующая дата повтора (UTC, полдень для стабильности дня). */
export function computeNextDueUtc(kind: TaskRecurrenceKind, payload: unknown, fromUtc: Date): Date {
  if (kind === "NONE") return new Date(fromUtc);

  const p = payload as {
    weekdays?: number[];
    dayOfMonth?: number;
    month?: number;
    day?: number;
  };

  if (kind === "DAILY") {
    const d = new Date(fromUtc);
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(12, 0, 0, 0);
    return d;
  }

  if (kind === "WEEKLY") {
    const weekdays = (Array.isArray(p?.weekdays) && p.weekdays.length > 0 ? p.weekdays : [1, 2, 3, 4, 5]) as number[];
    const set = new Set(weekdays.map((x) => ((x % 7) + 7) % 7));
    const cursor = new Date(fromUtc);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    cursor.setUTCHours(12, 0, 0, 0);
    for (let i = 0; i < 21; i++) {
      if (set.has(cursor.getUTCDay())) return new Date(cursor);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return cursor;
  }

  if (kind === "MONTHLY") {
    const dom = Math.min(31, Math.max(1, p?.dayOfMonth ?? 1));
    const d = new Date(fromUtc);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(dom, last));
    d.setUTCHours(12, 0, 0, 0);
    return d;
  }

  if (kind === "YEARLY") {
    const mo = Math.min(12, Math.max(1, p?.month ?? 1)) - 1;
    const day = Math.min(31, Math.max(1, p?.day ?? 1));
    const d = new Date(fromUtc);
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    const y = d.getUTCFullYear();
    const last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    d.setUTCMonth(mo);
    d.setUTCDate(Math.min(day, last));
    d.setUTCHours(12, 0, 0, 0);
    return d;
  }

  return new Date(fromUtc);
}

/** Первый срок для новой регулярной задачи: дата или ближайший подходящий момент. */
export function initialNextDueUtc(
  kind: TaskRecurrenceKind,
  payload: unknown,
  dueDate: Date | null | undefined,
  now: Date = new Date()
): Date {
  if (dueDate) {
    const d = new Date(dueDate);
    d.setUTCHours(12, 0, 0, 0);
    return d;
  }
  if (kind === "NONE") return now;
  return computeNextDueUtc(kind, payload, now);
}
