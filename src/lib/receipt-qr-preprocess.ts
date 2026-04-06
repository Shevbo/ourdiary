import sharp from "sharp";

const MAX_EDGE_PX = 4096;
const TARGET_MAX_BYTES = 7 * 1024 * 1024;

export async function preprocessReceiptImageForQrScan(input: Buffer): Promise<Buffer> {
  let pipeline = sharp(input).rotate();

  const meta = await pipeline.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const edge = Math.max(w, h);
  if (edge > MAX_EDGE_PX) {
    pipeline = pipeline.resize({
      width: MAX_EDGE_PX,
      height: MAX_EDGE_PX,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  let quality = 92;
  let out = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
  while (out.length > TARGET_MAX_BYTES && quality > 52) {
    quality -= 7;
    out = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
  }
  return out;
}
