"use client";

/**
 * Сжатие снимка чека перед multipart на /api/expenses/from-receipt.
 * Обходит лимит nginx client_max_body_size (часто 1 МБ) и ускоряет загрузку.
 */
const MAX_EDGE = 1920;
const TARGET_MAX_BYTES = 1_600_000;
const JPEG_QUALITY_START = 0.82;

export async function compressImageFileForReceiptUpload(file: File): Promise<File> {
  if (typeof createImageBitmap === "undefined" || typeof document === "undefined") {
    return file;
  }
  if (file.size <= TARGET_MAX_BYTES && /image\/jpe?g/i.test(file.type)) {
    return file;
  }

  let bmp: ImageBitmap | null = null;
  try {
    bmp = await createImageBitmap(file);
    const { width: iw, height: ih } = bmp;
    if (iw < 4 || ih < 4) return file;

    const scale = Math.min(1, MAX_EDGE / Math.max(iw, ih));
    const w = Math.max(1, Math.floor(iw * scale));
    const h = Math.max(1, Math.floor(ih * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);

    let q = JPEG_QUALITY_START;
    let blob: Blob | null = await new Promise((r) => canvas.toBlob((b) => r(b), "image/jpeg", q));
    while (blob && blob.size > TARGET_MAX_BYTES && q > 0.42) {
      q -= 0.08;
      blob = await new Promise((r) => canvas.toBlob((b) => r(b), "image/jpeg", q));
    }
    if (!blob?.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "receipt";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    bmp?.close();
  }
}
