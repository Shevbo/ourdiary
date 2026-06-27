import { NextRequest, NextResponse } from "next/server";
import { requireAlice } from "@/lib/alice-auth";
import { runDueReminders } from "@/lib/reminders";

/**
 * Поллер: дёргается по cron раз в минуту (см. scripts/run-reminders.sh).
 * Рассылает все «созревшие» напоминания и возвращает сводку.
 */
export async function POST(req: NextRequest) {
  const denied = requireAlice(req);
  if (denied) return denied;

  const result = await runDueReminders();
  return NextResponse.json(result);
}
