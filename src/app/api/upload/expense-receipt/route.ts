import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { compressReceiptTo100k } from "@/lib/compress-expense-receipt";

const MAX_INPUT = 12 * 1024 * 1024;

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
  if (file.size > MAX_INPUT) {
    return NextResponse.json({ error: "Исходный файл слишком большой" }, { status: 400 });
  }

  const raw = Buffer.from(await file.arrayBuffer());
  let jpeg: Buffer;
  try {
    jpeg = await compressReceiptTo100k(raw);
  } catch {
    return NextResponse.json({ error: "Не удалось обработать изображение" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "public", "uploads", "expense-receipts");
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.jpg`;
  await writeFile(path.join(dir, name), jpeg);

  return NextResponse.json({
    url: `/uploads/expense-receipts/${name}`,
    sizeBytes: jpeg.length,
  });
}
