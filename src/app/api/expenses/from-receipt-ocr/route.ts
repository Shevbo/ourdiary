import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeReceiptImageForApi } from "@/lib/receipt-image-normalize";
import { getTabscannerApiToken } from "@/lib/tabscanner-env";
import {
  tabscannerBuildImport,
  tabscannerProcess,
  tabscannerPollUntilDone,
} from "@/lib/receipt-tabscanner";
import { persistImportedReceiptExpense } from "@/lib/persist-imported-receipt-expense";

const MAX_BYTES = 32 * 1024 * 1024;

/**
 * Импорт расхода по фото чека без QR: OCR Tabscanner → позиции → те же категории ИИ, что у QR-импорта.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const apiKey = getTabscannerApiToken();
  if (!apiKey) {
    return NextResponse.json(
      { error: "На сервере не задан TABSCANNER_API_TOKEN (OCR Tabscanner)." },
      { status: 503 }
    );
  }

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Ожидается multipart/form-data с полем file" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Некорректные данные формы" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: "Прикрепите файл изображения (jpg/png)" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Файл слишком большой (макс. 32 МБ до обработки)" }, { status: 400 });
  }

  let imageBuffer: Buffer;
  let imageMime = file.type || "image/jpeg";
  let imageName = file.name?.trim() || "receipt.jpg";
  try {
    const raw = Buffer.from(await file.arrayBuffer());
    const converted = await normalizeReceiptImageForApi(raw, imageMime, imageName);
    imageBuffer = converted.buffer;
    imageMime = "image/jpeg";
    imageName = "receipt.jpg";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка обработки изображения";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const processed = await tabscannerProcess(apiKey, imageBuffer, imageMime, imageName);
  if ("error" in processed) {
    const code = processed.statusCode;
    const status =
      code === 401 ? 402 : code === 403 || code === 404 ? 400 : code && code >= 400 && code < 500 ? 502 : 502;
    return NextResponse.json({ error: processed.error }, { status });
  }

  let polled: Record<string, unknown>;
  try {
    polled = await tabscannerPollUntilDone(apiKey, processed.token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OCR недоступен";
    return NextResponse.json({ error: msg }, { status: 504 });
  }

  const { lines, expenseDate, importMeta } = tabscannerBuildImport(polled);
  if (lines.length === 0) {
    return NextResponse.json(
      {
        error:
          "По фото не удалось извлечь суммы. Снимите чек целиком, ровно, при хорошем свете; допустимы jpg/png.",
      },
      { status: 422 }
    );
  }

  const metaNote = `Импорт чека OCR (Tabscanner, ${lines.length} поз.)`;
  return persistImportedReceiptExpense(session.user.id, lines, expenseDate, metaNote, "tabscanner_ocr", importMeta);
}
