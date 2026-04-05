import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateFromFnsT, parseFnsQrRaw } from "@/lib/fns-qr";
import { guessExpenseCategoryFromProductName } from "@/lib/receipt-category";
import {
  callProverkachekaCheck,
  fallbackReceiptLinesFromFnsParams,
  fetchReceiptLinesProverkacheka,
  httpStatusForProverkachekaError,
} from "@/lib/receipt-proverkacheka";

const MAX_RECEIPT_IMAGE_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const token = process.env.PROVERKACHEKA_API_TOKEN?.trim();
  const ct = req.headers.get("content-type") ?? "";

  let qrraw: string | undefined;
  let imageBuffer: Buffer | undefined;
  let imageMime = "image/jpeg";
  let imageName = "receipt.jpg";

  if (ct.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "Некорректные данные формы" }, { status: 400 });
    }
    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_RECEIPT_IMAGE_BYTES) {
        return NextResponse.json({ error: "Файл слишком большой (макс. 8 МБ)" }, { status: 400 });
      }
      imageBuffer = Buffer.from(await file.arrayBuffer());
      imageMime = file.type || "image/jpeg";
      imageName = file.name?.trim() || "receipt.jpg";
    }
  } else {
    let body: { qrraw?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    qrraw = String(body.qrraw ?? "").trim();
  }

  if (!qrraw && !imageBuffer) {
    return NextResponse.json(
      { error: "Укажите qrraw в JSON или загрузите файл (multipart, поле file)" },
      { status: 400 }
    );
  }

  if (imageBuffer && !token) {
    return NextResponse.json(
      {
        error:
          "Для импорта по фото чека нужен PROVERKACHEKA_API_TOKEN в переменных окружения сервера.",
      },
      { status: 400 }
    );
  }

  let lines: { name: string; sum: number }[] = [];
  let source: "proverkacheka" | "qr_sum" = "qr_sum";

  if (imageBuffer && token) {
    const r = await callProverkachekaCheck(token, {
      file: imageBuffer,
      filename: imageName,
      mime: imageMime,
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: r.error },
        { status: httpStatusForProverkachekaError(r.error, r.code) }
      );
    }
    lines = r.lines;
    source = "proverkacheka";
    const expenseDate = dateFromFnsT(r.parsedQr.t) ?? new Date();
    const metaNote = `Импорт чека по фото (${lines.length} поз.) ФН ${r.parsedQr.fn ?? "—"} ФД ${r.parsedQr.i ?? "—"}`;
    return await persistExpenseLines(session.user.id, lines, expenseDate, metaNote);
  }

  const parsed = parseFnsQrRaw(qrraw!);
  if (!parsed) return NextResponse.json({ error: "Не удалось разобрать QR" }, { status: 400 });

  if (token) {
    const fromApi = await fetchReceiptLinesProverkacheka(qrraw!, token);
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

  return await persistExpenseLines(session.user.id, lines, expenseDate, metaNote, source);
}

async function persistExpenseLines(
  userId: string,
  lines: { name: string; sum: number }[],
  expenseDate: Date,
  metaNote: string,
  source: "proverkacheka" | "qr_sum" = "proverkacheka"
) {
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
          authorId: userId,
        },
      });
      rows.push({ id: e.id, title: e.title, amount: e.amount, category: e.category });
    }

    await tx.ratingPoint.create({
      data: {
        userId,
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
