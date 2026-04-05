import sharp from "sharp";

const MAX_BYTES = 100 * 1024;

/** Ч/б JPEG, не больше ~100 КБ на файл (одна «страница» скана; многостраничные — отдельные вложения). */
export async function compressReceiptTo100k(input: Buffer): Promise<Buffer> {
  let width = 1600;

  for (let attempt = 0; attempt < 12; attempt++) {
    const q = Math.max(45, 88 - attempt * 6);
    const out = await sharp(input)
      .rotate()
      .grayscale()
      .resize({ width, height: 2200, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: q, mozjpeg: true })
      .toBuffer();
    if (out.length <= MAX_BYTES) return out;
    width = Math.max(480, Math.floor(width * 0.85));
  }

  return sharp(input)
    .rotate()
    .grayscale()
    .resize({ width: 480, fit: "inside" })
    .jpeg({ quality: 45, mozjpeg: true })
    .toBuffer();
}
