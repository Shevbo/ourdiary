import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/sms";

/**
 * Сопоставление «получателя» из напоминания с реальным номером телефона.
 * Карта номеров берётся из env REMINDER_PHONES — JSON-строка вида
 *   {"я":"+7...","мне":"+7...","boris":"+7..."}
 * Поиск кейс-инсенситивный по ключу. Неизвестный получатель → null.
 */
export function resolveRecipientPhone(recipient: string): string | null {
  const raw = process.env.REMINDER_PHONES;
  if (!raw) return null;

  let map: Record<string, unknown>;
  try {
    map = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.warn("[reminders] REMINDER_PHONES is not valid JSON");
    return null;
  }

  const want = recipient.trim().toLowerCase();
  for (const [key, value] of Object.entries(map)) {
    if (key.trim().toLowerCase() === want && typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export interface RunDueResult {
  sent: number;
  failed: number;
  skipped: number;
}

function formatReminderTime(date: Date): string {
  // Локаль/таймзона сервера; короткий формат "ДД.ММ ЧЧ:ММ".
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${dd}.${mm} ${hh}:${mi}`;
}

/**
 * Найти все «созревшие» напоминания (sentAt is null, remindAt <= now),
 * разослать SMS и пометить отправленные. Ошибки ловятся пер-напоминание,
 * чтобы один сбой не валил весь прогон.
 */
export async function runDueReminders(): Promise<RunDueResult> {
  const due = await prisma.reminder.findMany({
    where: { sentAt: null, remindAt: { lte: new Date() } },
    include: { event: true },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const r of due) {
    const phone = resolveRecipientPhone(r.recipient);
    if (!phone) {
      skipped++;
      console.warn(`[reminders] skip ${r.id}: unknown recipient "${r.recipient}"`);
      continue;
    }

    const title = r.event?.title ?? "событие";
    const when = r.event?.date ? ` (${formatReminderTime(r.event.date)})` : "";
    const text = r.text ?? `Напоминание: ${title}${when}`;

    try {
      await sendSms(phone, text);
      await prisma.reminder.update({
        where: { id: r.id },
        data: { sentAt: new Date() },
      });
      sent++;
    } catch (err) {
      failed++;
      console.error(`[reminders] send failed for ${r.id} (${phone}):`, err);
    }
  }

  return { sent, failed, skipped };
}
