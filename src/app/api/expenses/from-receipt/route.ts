import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canonicalFnsQrraw, dateFromFnsT, parseFnsQrRaw } from "@/lib/fns-qr";
import { decodeQrFromImageBuffer } from "@/lib/decode-qr-from-buffer";
import { decodeQrViaSidecar } from "@/lib/qr-decode-sidecar";
import { getProverkachekaToken } from "@/lib/proverkacheka-env";
import { normalizeReceiptImageForApi } from "@/lib/receipt-image-normalize";
import { preprocessReceiptImageForQrScan } from "@/lib/receipt-qr-preprocess";
import {
  callProverkachekaCheck,
  extractReceiptImportMetaFromProverkachekaJson,
  fallbackReceiptLinesFromFnsParams,
  type ReceiptImportMeta,
} from "@/lib/receipt-proverkacheka";
import { classifyReceiptExpenseLines, resolvePlaceNameForExpense } from "@/lib/receipt-expense-ai";

/** До предобработки на сервере (см. preprocessReceiptImageForQrScan); nginx — client_max_body_size ≥ 32m. */
const MAX_RECEIPT_IMAGE_BYTES = 32 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const token = getProverkachekaToken();
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
        return NextResponse.json({ error: "Файл слишком большой (макс. 32 МБ до обработки)" }, { status: 400 });
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
    const rawIn = String(body.qrraw ?? "").trim();
    qrraw = canonicalFnsQrraw(rawIn) ?? rawIn;
  }

  if (!qrraw && !imageBuffer) {
    return NextResponse.json(
      { error: "Укажите qrraw в JSON или загрузите файл (multipart, поле file)" },
      { status: 400 }
    );
  }

  if (imageBuffer) {
    try {
      const converted = await normalizeReceiptImageForApi(imageBuffer, imageMime, imageName);
      const prepped = await preprocessReceiptImageForQrScan(converted.buffer);

      let raw = await decodeQrViaSidecar(prepped, "image/jpeg");
      if (!raw) {
        raw = await decodeQrFromImageBuffer(prepped);
      }

      const canon = raw ? (canonicalFnsQrraw(raw) ?? raw.trim()) : null;
      if (!canon) {
        return NextResponse.json(
          {
            error:
              "Не удалось прочитать QR на фото. Снимите QR крупнее и контрастнее; на сервере можно поднять ourdiary-qr-decode и задать OURDIARY_QR_DECODE_URL (см. docs/qr-decode-service.md).",
          },
          { status: 422 }
        );
      }
      qrraw = canon;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка обработки фото чека";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (!qrraw) {
    return NextResponse.json({ error: "Пустая строка чека" }, { status: 400 });
  }

  const parsed = parseFnsQrRaw(qrraw);
  if (!parsed) return NextResponse.json({ error: "Не удалось разобрать QR" }, { status: 400 });

  let lines: { name: string; sum: number }[] = [];
  let source: "proverkacheka" | "qr_sum" = "qr_sum";
  let importMeta: ReceiptImportMeta | undefined;

  if (token) {
    const r = await callProverkachekaCheck(token, { qrraw });
    if (r.ok && r.lines.length > 0) {
      lines = r.lines;
      source = "proverkacheka";
      importMeta = extractReceiptImportMetaFromProverkachekaJson(r.rawJson);
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
          "Нет данных по чеку. Добавьте PROVERKACHEKA_API_TOKEN на сервере для позиций из ФНС или проверьте QR.",
      },
      { status: 422 }
    );
  }

  const expenseDate = dateFromFnsT(parsed.t) ?? new Date();
  const metaNote = `Импорт чека (${lines.length} поз.) ФН ${parsed.fn ?? "—"} ФД ${parsed.i ?? "—"}`;

  return await persistExpenseLines(session.user.id, lines, expenseDate, metaNote, source, importMeta);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

async function persistExpenseLines(
  userId: string,
  lines: { name: string; sum: number }[],
  expenseDate: Date,
  metaNote: string,
  source: "proverkacheka" | "qr_sum",
  importMeta?: ReceiptImportMeta
) {
  const totalAmount = roundMoney(lines.reduce((s, l) => s + l.sum, 0));
  const title = `Чек · ${lines.length} поз.`.slice(0, 200);

  const categoryDefinitions = await prisma.expenseCategoryDefinition.findMany({
    where: { isActive: true },
    select: { code: true, label: true },
    orderBy: { sortOrder: "asc" },
  });
  const { parentCategory, lineCategories } = await classifyReceiptExpenseLines({
    lines,
    importMeta,
    categoryDefinitions,
  });

  const created = await prisma.$transaction(async (tx) => {
    let placeId: string | undefined;
    const placeName = resolvePlaceNameForExpense(importMeta);
    if (placeName) {
      const name = placeName.slice(0, 200);
      const existing = await tx.expensePlace.findFirst({ where: { name } });
      placeId = existing?.id ?? (await tx.expensePlace.create({ data: { name } })).id;
    }

    const noteParts: string[] = [metaNote];
    if (importMeta?.retailPlaceAddress) noteParts.push(importMeta.retailPlaceAddress);
    if (importMeta?.sellerName) noteParts.push(`Продавец: ${importMeta.sellerName}`);
    if (importMeta?.userInn) noteParts.push(`ИНН: ${importMeta.userInn}`);
    if (importMeta?.operator) noteParts.push(`Кассир: ${importMeta.operator}`);
    const firstNote = noteParts.join("\n").slice(0, 2000);

    const parent = await tx.expense.create({
      data: {
        title,
        amount: totalAmount,
        category: parentCategory,
        date: expenseDate,
        note: firstNote,
        currency: "RUB",
        authorId: userId,
        beneficiary: "FAMILY",
        placeId: placeId ?? null,
      },
    });

    const receiptLines: { id: string; title: string; amount: unknown; category: string; sortOrder: number }[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineCat = lineCategories[i] ?? "OTHER";
      const row = await tx.expenseReceiptLine.create({
        data: {
          expenseId: parent.id,
          title: line.name.slice(0, 200),
          amount: roundMoney(line.sum),
          category: lineCat,
          sortOrder: i,
        },
      });
      receiptLines.push({
        id: row.id,
        title: row.title,
        amount: row.amount,
        category: row.category,
        sortOrder: row.sortOrder,
      });
    }

    await tx.ratingPoint.create({
      data: {
        userId,
        points: 2,
        reason: `Импорт чека (${lines.length} поз.)`,
        type: "EXPENSE_ADDED",
      },
    });

    return {
      parent,
      receiptLines,
    };
  });

  const expenseJson = {
    id: created.parent.id,
    title: created.parent.title,
    amount: Number(created.parent.amount),
    category: created.parent.category,
    receiptLines: created.receiptLines.map((r) => ({
      id: r.id,
      title: r.title,
      amount: Number(r.amount),
      category: r.category,
      sortOrder: r.sortOrder,
    })),
  };

  return NextResponse.json({
    ok: true,
    count: 1,
    receiptLineCount: lines.length,
    source,
    expenses: [expenseJson],
  });
}
