import sharp from "sharp";

/**
 * ProverkaCheka в документации перечисляет bmp, gif, jpeg, png, tiff, pdf.
 * С телефона часто приходят HEIC/WEBP — конвертируем в JPEG.
 */
export async function normalizeReceiptImageForApi(
  buffer: Buffer,
  mime: string,
  filename: string
): Promise<{ buffer: Buffer; mime: string; filename: string }> {
  const lower = filename.toLowerCase();
  const m = (mime || "").toLowerCase();
  const needsConvert =
    m === "image/heic" ||
    m === "image/heif" ||
    m === "image/webp" ||
    lower.endsWith(".heic") ||
    lower.endsWith(".heif") ||
    lower.endsWith(".webp");
  if (!needsConvert) {
    return { buffer, mime: mime || "image/jpeg", filename };
  }
  try {
    const out = await sharp(buffer).rotate().jpeg({ quality: 90 }).toBuffer();
    const base = filename.replace(/\.[^./\\]+$/, "") || "receipt";
    return { buffer: out, mime: "image/jpeg", filename: `${base}.jpg` };
  } catch {
    return { buffer, mime: mime || "image/jpeg", filename };
  }
}
