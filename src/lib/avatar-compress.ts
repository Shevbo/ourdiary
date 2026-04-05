/** Целевой размер файла аватара после сжатия (байт) */
export const AVATAR_TARGET_MAX_BYTES = 330 * 1024;

async function fileToImageBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Не удалось прочитать изображение"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas недоступен");
      ctx.drawImage(img, 0, 0);
      return await createImageBitmap(canvas);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/**
 * Сжимает изображение в JPEG не больше maxBytes (по умолчанию ~330 КБ).
 */
export async function compressImageToJpegFile(file: File, maxBytes: number = AVATAR_TARGET_MAX_BYTES): Promise<File> {
  const bitmap = await fileToImageBitmap(file);
  try {
    const w0 = bitmap.width;
    const h0 = bitmap.height;
    let maxDim = Math.min(2048, Math.max(w0, h0));
    let quality = 0.88;

    for (let iter = 0; iter < 28; iter++) {
      const scale = Math.min(1, maxDim / Math.max(w0, h0));
      const cw = Math.max(1, Math.round(w0 * scale));
      const ch = Math.max(1, Math.round(h0 * scale));

      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas недоступен");
      ctx.drawImage(bitmap, 0, 0, cw, ch);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
      );
      if (!blob) throw new Error("Не удалось сжать изображение");

      if (blob.size <= maxBytes) {
        return new File([blob], "avatar.jpg", { type: "image/jpeg", lastModified: Date.now() });
      }

      if (quality > 0.42) {
        quality -= 0.06;
      } else {
        maxDim = Math.round(maxDim * 0.88);
        if (maxDim < 96) {
          return new File([blob], "avatar.jpg", { type: "image/jpeg", lastModified: Date.now() });
        }
      }
    }

    const scale = Math.min(1, 96 / Math.max(w0, h0));
    const cw = Math.max(1, Math.round(w0 * scale));
    const ch = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, cw, ch);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.35)
    );
    if (!blob) throw new Error("Не удалось сжать изображение");
    return new File([blob], "avatar.jpg", { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
