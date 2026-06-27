import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isExpired } from "@/lib/upload-token";
import { savePhoto, saveVideo, MAX_VIDEO_BYTES } from "@/lib/uploads";

// Узел Node (sharp, fs) — не Edge.
export const runtime = "nodejs";

function htmlResponse(body: string, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="ru"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Загрузка</title></head><body style="font-family:system-ui;padding:24px;` +
      `max-width:480px;margin:0 auto;text-align:center;color:#334155">${body}</body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const record = await prisma.uploadToken.findUnique({
    where: { token },
    select: { eventId: true, expiresAt: true },
  });
  if (!record || isExpired(record.expiresAt)) {
    return htmlResponse(
      `<h1>Ссылка недействительна</h1><p>QR-код истёк или не найден.</p>`,
      410
    );
  }

  const eventId = record.eventId;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return htmlResponse(`<h1>Ошибка</h1><p>Не удалось прочитать форму.</p>`, 400);
  }

  const text = (form.get("text") as string | null)?.trim() || null;
  const caption = (form.get("caption") as string | null)?.trim() || null;
  const photo = form.get("photo");
  const video = form.get("video");

  const created: { kind: string; path?: string; text?: string; caption: string | null }[] = [];

  // Видео: проверяем лимит размера до записи
  if (video instanceof Blob && video.size > 0) {
    if (video.size > MAX_VIDEO_BYTES) {
      return htmlResponse(
        `<h1>Видео слишком большое</h1><p>Лимит — 100 МБ. ` +
          `Ваш файл: ${(video.size / (1024 * 1024)).toFixed(0)} МБ.</p>` +
          `<p><a href="/u/${token}">Назад</a></p>`,
        413
      );
    }
    const buf = Buffer.from(await video.arrayBuffer());
    const path = await saveVideo(eventId, buf, video.type || "video/mp4");
    created.push({ kind: "video", path, caption });
  }

  // Фото: сжимаем sharp
  if (photo instanceof Blob && photo.size > 0) {
    const buf = Buffer.from(await photo.arrayBuffer());
    const path = await savePhoto(eventId, buf, photo.type || "image/jpeg");
    created.push({ kind: "photo", path, caption });
  }

  // Текстовая заметка
  if (text) {
    created.push({ kind: "text", text, caption });
  }

  if (created.length === 0) {
    return htmlResponse(
      `<h1>Пусто</h1><p>Добавьте заметку, фото или видео.</p>` +
        `<p><a href="/u/${token}">Назад</a></p>`,
      400
    );
  }

  await prisma.attachment.createMany({
    data: created.map((c) => ({
      eventId,
      kind: c.kind,
      path: c.path ?? null,
      text: c.text ?? null,
      caption: c.caption,
    })),
  });

  // НЕ помечаем токен used — можно загружать ещё до истечения срока.
  // Возвращаем на страницу с подтверждением.
  return NextResponse.redirect(new URL(`/u/${token}?ok=1`, req.nextUrl.origin), 303);
}
