/**
 * Распознавание фискальной строки QR с изображения (сервер, sharp + ZBar/ZXing).
 * Используется, когда фото пришло без PROVERKACHEKA_API_TOKEN — извлекаем qrraw локально.
 */
import sharp from "sharp";
import jsQR from "jsqr";
import { scanGrayBuffer, scanRGBABuffer } from "@undecaf/zbar-wasm";
import {
  BinaryBitmap,
  HybridBinarizer,
  GlobalHistogramBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
  DecodeHintType,
  BarcodeFormat,
} from "@zxing/library";

function pickQrString(symbols: { decode: (enc?: string) => string }[]): string | null {
  if (!symbols?.length) return null;
  for (const s of symbols) {
    const t = s.decode();
    if (t) return t;
  }
  return null;
}

async function tryZbarGray(pipeline: sharp.Sharp): Promise<string | null> {
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  if (data.length !== w * h) return null;
  const ab = new Uint8Array(data).buffer;
  const symbols = await scanGrayBuffer(ab, w, h);
  return pickQrString(symbols);
}

async function tryZbarRgba(pipeline: sharp.Sharp): Promise<string | null> {
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  if (data.length !== w * h * 4) return null;
  const ab = new Uint8Array(data).buffer;
  const symbols = await scanRGBABuffer(ab, w, h);
  return pickQrString(symbols);
}

function rgbaToLuminance(rgba: Uint8ClampedArray, width: number, height: number) {
  const out = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const r = rgba[o];
    const g = rgba[o + 1];
    const b = rgba[o + 2];
    out[i] = ((r * 299 + g * 587 + b * 114) / 1000) | 0;
  }
  return out;
}

function invertLum(lum: Uint8ClampedArray) {
  const out = new Uint8ClampedArray(lum.length);
  for (let i = 0; i < lum.length; i++) out[i] = 255 - lum[i];
  return out;
}

function tryZxingOne(
  lum: Uint8ClampedArray,
  width: number,
  height: number,
  Binarizer: typeof HybridBinarizer | typeof GlobalHistogramBinarizer
) {
  try {
    const source = new RGBLuminanceSource(lum, width, height, width, height, 0, 0);
    const bitmap = new BinaryBitmap(new Binarizer(source));
    const reader = new MultiFormatReader();
    reader.setHints(new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]]]));
    return reader.decode(bitmap).getText();
  } catch {
    return null;
  }
}

function tryZxing(rgba: Uint8ClampedArray, width: number, height: number) {
  const lum = rgbaToLuminance(rgba, width, height);
  const variants: [typeof HybridBinarizer | typeof GlobalHistogramBinarizer, Uint8ClampedArray][] = [
    [HybridBinarizer, lum],
    [GlobalHistogramBinarizer, lum],
    [HybridBinarizer, invertLum(lum)],
    [GlobalHistogramBinarizer, invertLum(lum)],
  ];
  for (const [Binarizer, l] of variants) {
    const t = tryZxingOne(l, width, height, Binarizer);
    if (t) return t;
  }
  return null;
}

function tryJsQr(rgba: Uint8ClampedArray, width: number, height: number) {
  try {
    const r = jsQR(rgba, width, height);
    return r?.data ?? null;
  } catch {
    return null;
  }
}

async function toRgba(pipeline: sharp.Sharp) {
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { rgba: new Uint8ClampedArray(data), width: info.width, height: info.height };
}

const ZBAR_GRAY_ATTEMPTS: [number, number][] = [
  [2500, 140],
  [2500, 160],
  [2500, 128],
  [2000, 140],
  [3000, 140],
  [2000, 160],
  [3000, 160],
  [2500, 120],
  [2500, 180],
  [2500, 100],
  [4000, 140],
  [4000, 160],
];

/** Возвращает сырую строку из QR или null. */
export async function decodeQrFromImageBuffer(input: Buffer): Promise<string | null> {
  const base = sharp(input).autoOrient();

  for (const [width, th] of ZBAR_GRAY_ATTEMPTS) {
    const t = await tryZbarGray(
      base
        .clone()
        .resize({ width, fit: "inside", withoutEnlargement: false })
        .greyscale()
        .normalize()
        .threshold(th)
        .raw()
    );
    if (t) return t;
  }

  const rgbaZbarVariants = [
    base.clone().ensureAlpha().raw(),
    base
      .clone()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: false })
      .normalize()
      .ensureAlpha()
      .raw(),
    base
      .clone()
      .resize({ width: 3000, height: 3000, fit: "inside", withoutEnlargement: false })
      .normalize()
      .ensureAlpha()
      .raw(),
  ];
  for (const prep of rgbaZbarVariants) {
    const t = await tryZbarRgba(prep);
    if (t) return t;
  }

  const zxingVariants = [
    base.clone().ensureAlpha().raw(),
    base
      .clone()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: false })
      .normalize()
      .ensureAlpha()
      .raw(),
    base
      .clone()
      .resize({ width: 3000, height: 3000, fit: "inside", withoutEnlargement: false })
      .greyscale()
      .normalize()
      .ensureAlpha()
      .raw(),
    base
      .clone()
      .resize({ width: 4000, height: 4000, fit: "inside", withoutEnlargement: false })
      .modulate({ brightness: 1.15, saturation: 0.5 })
      .sharpen()
      .ensureAlpha()
      .raw(),
  ];
  for (const prep of zxingVariants) {
    const { rgba, width, height } = await toRgba(prep);
    if (rgba.length !== width * height * 4) continue;
    const decoded = tryZxing(rgba, width, height) || tryJsQr(rgba, width, height);
    if (decoded) return decoded;
  }

  return null;
}
