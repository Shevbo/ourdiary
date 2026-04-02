import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isToday(d)) return "Сегодня";
  if (isTomorrow(d)) return "Завтра";
  if (isYesterday(d)) return "Вчера";
  return format(d, "d MMMM yyyy", { locale: ru });
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "d MMM", { locale: ru });
}

export function formatRelative(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: ru });
}

export function formatMoney(amount: number | string, currency = "RUB"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  FOOD: "Еда",
  TRANSPORT: "Транспорт",
  ENTERTAINMENT: "Развлечения",
  HEALTH: "Здоровье",
  EDUCATION: "Образование",
  CLOTHING: "Одежда",
  HOME: "Дом",
  VACATION: "Отпуск",
  OTHER: "Прочее",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  DIARY: "Дневник",
  PLAN: "Планы",
  BIRTHDAY: "День рождения",
  HOLIDAY: "Праздник",
  REMINDER: "Напоминание",
};

export const EVENT_TYPE_COLORS: Record<string, string> = {
  DIARY: "bg-blue-100 text-blue-800",
  PLAN: "bg-green-100 text-green-800",
  BIRTHDAY: "bg-pink-100 text-pink-800",
  HOLIDAY: "bg-orange-100 text-orange-800",
  REMINDER: "bg-yellow-100 text-yellow-800",
};
