import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateFromFnsT, parseFnsQrRaw } from "@/lib/fns-qr";
import { guessExpenseCategoryFromProductName } from "@/lib/receipt-category";
import {
  fallbackReceiptLinesFromFnsParams,
  fetchReceiptLinesProverkacheka,
} from "@/lib/receipt-proverkacheka";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  let body: { qrraw?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const qrraw = String(body.qrraw ?? "").trim();
  if (!qrraw) return NextResponse.json({ error: "qrraw обязателен" }, { status: 400 });

  const parsed = parseFnsQrRaw(qrraw);
  if (!parsed) return NextResponse.json({ error: "Не удалось разобрать QR" }, { status: 400 });

  const token = process.env.PROVERKACHEKA_API_TOKEN?.trim();
  let lines: { name: string; sum: number }[] = [];
  let source: "proverkacheka" | "qr_sum" = "qr_sum";

  if (token) {
    const fromApi = await fetchReceiptLinesProverkacheka(qrraw, token);
    if (fromApi?.length) {
      lines = fromApi;
      source = "proverkacheka";
    }
  }
  if (lines.length === 0) {
    lines = fallbackReceiptLinesFromFnsParams(parsed);
    source = "qr_sum";
  }

  if (lines.length === 0) {
    return NextResponse.json(
      {
        error:
          "Нет данных по чеку. Добавьте PROVERKACHEKA_API_TOKEN в .env для разбора позиций или проверьте QR.",
      },
      { status: 422 }
    );
  }

  const expenseDate = dateFromFnsT(parsed.t) ?? new Date();
  const metaNote = `Импорт чека (${lines.length} поз.) ФН ${parsed.fn ?? "—"} ФД ${parsed.i ?? "—"}`;

  const created = await prisma.$transaction(async (tx) => {
    const rows: { id: string; title: string; amount: unknown; category: string }[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cat = guessExpenseCategoryFromProductName(line.name);
      const e = await tx.expense.create({
        data: {
          title: line.name.slice(0, 200),
          amount: line.sum,
          category: cat,
          date: expenseDate,
          note: i === 0 ? metaNote : null,
          currency: "RUB",
          authorId: session.user.id,
        },
      });
      rows.push({ id: e.id, title: e.title, amount: e.amount, category: e.category });
    }

    await tx.ratingPoint.create({
      data: {
        userId: session.user.id,
        points: 2,
        reason: `Импорт чека (${lines.length} поз.)`,
        type: "EXPENSE_ADDED",
      },
    });

    return rows;
  });

  return NextResponse.json({
    ok: true,
    count: created.length,
    source,
    expenses: created,
  });
}
