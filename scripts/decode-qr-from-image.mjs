#!/usr/bin/env node
/**
 * Декодирует QR с изображения и печатает сырую строку (фискальный чек РФ: t=...&s=...).
 *
 * Библиотеки (репозиторий):
 *   - sharp — подготовка RGBA
 *   - @zxing/library — основной декодер (как в промышленных сканерах)
 *   - jsqr — запасной вариант
 *
 *   node scripts/decode-qr-from-image.mjs путь/к/фото.png
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import jsQR from "jsqr";
import {
  BinaryBitmap,
  HybridBinarizer,
  GlobalHistogramBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
  DecodeHintType,
  BarcodeFormat,
} from "@zxing/library";

const imagePath = process.argv[2]?.trim();
if (!imagePath) {
  console.error("usage: node scripts/decode-qr-from-image.mjs <path-to-image>");
  process.exit(1);
}

const resolved = path.resolve(imagePath);
if (!fs.existsSync(resolved)) {
  console.error("Файл не найден:", resolved);
  process.exit(1);
}

function rgbaToLuminance(rgba, width, height) {
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

function invertLum(lum) {
  const out = new Uint8ClampedArray(lum.length);
  for (let i = 0; i < lum.length; i++) out[i] = 255 - lum[i];
  return out;
}

function tryZxingOne(lum, width, height, Binarizer) {
  try {
    const source = new RGBLuminanceSource(lum, width, height, width, height, 0, 0);
    const bitmap = new BinaryBitmap(new Binarizer(source));
    const reader = new MultiFormatReader();
    reader.setHints(
      new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]]])
    );
    return reader.decode(bitmap).getText();
  } catch {
    return null;
  }
}

function tryZxing(rgba, width, height) {
  const lum = rgbaToLuminance(rgba, width, height);
  const variants = [
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

function tryJsQr(rgba, width, height) {
  try {
    const r = jsQR(rgba, width, height);
    return r?.data ?? null;
  } catch {
    return null;
  }
}

async function toRgba(pipeline) {
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { rgba: new Uint8ClampedArray(data), width: info.width, height: info.height };
}

const base = sharp(resolved).autoOrient();
const variants = [
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

let decoded = null;
for (const prep of variants) {
  const { rgba, width, height } = await toRgba(prep);
  if (rgba.length !== width * height * 4) continue;
  decoded = tryZxing(rgba, width, height) || tryJsQr(rgba, width, height);
  if (decoded) break;
}

if (!decoded) {
  console.error("QR-код не найден (попробуйте другое фото или выше разрешение).");
  process.exit(2);
}

console.log("--- распознанная строка QR ---");
console.log(decoded);
console.log("--- конец ---");
