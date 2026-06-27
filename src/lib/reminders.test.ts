import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Мок prisma-клиента: подменяем модуль до импорта тестируемого кода.
const reminderFindMany = vi.fn();
const reminderUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reminder: {
      findMany: (...args: unknown[]) => reminderFindMany(...args),
      update: (...args: unknown[]) => reminderUpdate(...args),
    },
  },
}));

// Мок SMS-шлюза.
const sendSms = vi.fn();
vi.mock("@/lib/sms", () => ({
  sendSms: (...args: unknown[]) => sendSms(...args),
}));

import { resolveRecipientPhone, runDueReminders } from "@/lib/reminders";

const ORIG_ENV = process.env.REMINDER_PHONES;

afterEach(() => {
  if (ORIG_ENV === undefined) delete process.env.REMINDER_PHONES;
  else process.env.REMINDER_PHONES = ORIG_ENV;
  vi.clearAllMocks();
});

describe("resolveRecipientPhone", () => {
  beforeEach(() => {
    process.env.REMINDER_PHONES = JSON.stringify({ "я": "+70000000001", "Boris": "+70000000002" });
  });

  it("resolves a known recipient", () => {
    expect(resolveRecipientPhone("я")).toBe("+70000000001");
  });

  it("is case-insensitive on the key", () => {
    expect(resolveRecipientPhone("boris")).toBe("+70000000002");
    expect(resolveRecipientPhone("  BORIS ")).toBe("+70000000002");
  });

  it("returns null for an unknown recipient", () => {
    expect(resolveRecipientPhone("мама")).toBeNull();
  });

  it("returns null when REMINDER_PHONES is unset", () => {
    delete process.env.REMINDER_PHONES;
    expect(resolveRecipientPhone("я")).toBeNull();
  });

  it("returns null when REMINDER_PHONES is invalid JSON", () => {
    process.env.REMINDER_PHONES = "{not json";
    expect(resolveRecipientPhone("я")).toBeNull();
  });
});

describe("runDueReminders", () => {
  beforeEach(() => {
    process.env.REMINDER_PHONES = JSON.stringify({ "я": "+70000000001" });
  });

  it("sends, marks sentAt and counts sent", async () => {
    reminderFindMany.mockResolvedValue([
      { id: "r1", recipient: "я", text: null, event: { title: "Др", date: new Date("2026-07-01T10:00:00Z") } },
    ]);
    sendSms.mockResolvedValue(undefined);
    reminderUpdate.mockResolvedValue({});

    const res = await runDueReminders();

    expect(sendSms).toHaveBeenCalledTimes(1);
    const [phone, text] = sendSms.mock.calls[0];
    expect(phone).toBe("+70000000001");
    expect(text).toContain("Напоминание: Др");
    expect(reminderUpdate).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ sent: 1, failed: 0, skipped: 0 });
  });

  it("uses custom text when provided", async () => {
    reminderFindMany.mockResolvedValue([
      { id: "r1", recipient: "я", text: "Купи торт", event: { title: "Др", date: null } },
    ]);
    sendSms.mockResolvedValue(undefined);
    reminderUpdate.mockResolvedValue({});

    await runDueReminders();
    expect(sendSms.mock.calls[0][1]).toBe("Купи торт");
  });

  it("skips unknown recipients and does not send", async () => {
    reminderFindMany.mockResolvedValue([
      { id: "r1", recipient: "неизвестный", text: null, event: { title: "X", date: null } },
    ]);

    const res = await runDueReminders();
    expect(sendSms).not.toHaveBeenCalled();
    expect(reminderUpdate).not.toHaveBeenCalled();
    expect(res).toEqual({ sent: 0, failed: 0, skipped: 1 });
  });

  it("counts a send failure without aborting the run", async () => {
    reminderFindMany.mockResolvedValue([
      { id: "r1", recipient: "я", text: null, event: { title: "A", date: null } },
      { id: "r2", recipient: "я", text: null, event: { title: "B", date: null } },
    ]);
    sendSms.mockRejectedValueOnce(new Error("gateway down")).mockResolvedValueOnce(undefined);
    reminderUpdate.mockResolvedValue({});

    const res = await runDueReminders();
    expect(sendSms).toHaveBeenCalledTimes(2);
    expect(reminderUpdate).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ sent: 1, failed: 1, skipped: 0 });
  });
});
