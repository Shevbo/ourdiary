import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Файл больше 5 МБ" }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  const ext = ALLOWED.get(mime);
  if (!ext) {
    return NextResponse.json({ error: "Допустимы только JPEG, PNG, WebP или GIF" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads", "events");
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, name), buf);

  return NextResponse.json({ url: `/uploads/events/${name}` });
}
