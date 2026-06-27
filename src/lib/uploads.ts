import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";

/**
 * Конвенция хранения как у event-image: файлы кладём в public/uploads/...
 * и отдаём по пути /uploads/... (статика Next, исключена из middleware).
 *
 * Вложения ТВ-календаря: public/uploads/calendar/<eventId>/<uuid>.<ext>
 * Публичный URL:        /uploads/calendar/<eventId>/<uuid>.<ext>
 */

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024; // исходное фото до сжатия
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // лимит видео ~100 МБ

const PHOTO_EXT = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
]);

const VIDEO_EXT = new Map<string, string>([
  ["video/mp4", "mp4"],
  ["video/quicktime", "mov"],
  ["video/webm", "webm"],
  ["video/3gpp", "3gp"],
  ["video/x-matroska", "mkv"],
]);

export type AttachmentKind = "text" | "photo" | "video";

/** Выбор вида вложения по MIME-типу файла. */
export function kindFromMime(mime: string): "photo" | "video" | null {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) return "photo";
  if (m.startsWith("video/")) return "video";
  return null;
}

function calendarDir(eventId: string): string {
  return path.join(process.cwd(), "public", "uploads", "calendar", eventId);
}

function publicUrl(eventId: string, name: string): string {
  return `/uploads/calendar/${eventId}/${name}`;
}

/**
 * Сохраняет фото: при возможности сжимает sharp в webp (макс. сторона 1600px).
 * Если формат не распознан sharp (например HEIC без поддержки) — кладём как есть.
 * Возвращает публичный путь.
 */
export async function savePhoto(eventId: string, buf: Buffer, mime: string): Promise<string> {
  const dir = calendarDir(eventId);
  await mkdir(dir, { recursive: true });
  const id = randomUUID();

  try {
    const out = await sharp(buf)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const name = `${id}.webp`;
    await writeFile(path.join(dir, name), out);
    return publicUrl(eventId, name);
  } catch {
    // sharp не справился — пишем оригинал с расширением по MIME
    const ext = PHOTO_EXT.get((mime || "").toLowerCase()) ?? "bin";
    const name = `${id}.${ext}`;
    await writeFile(path.join(dir, name), buf);
    return publicUrl(eventId, name);
  }
}

/** Сохраняет видео как есть; расширение по MIME. Возвращает публичный путь. */
export async function saveVideo(eventId: string, buf: Buffer, mime: string): Promise<string> {
  const dir = calendarDir(eventId);
  await mkdir(dir, { recursive: true });
  const ext = VIDEO_EXT.get((mime || "").toLowerCase()) ?? "mp4";
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, name), buf);
  return publicUrl(eventId, name);
}
