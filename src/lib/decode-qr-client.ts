"use client";

/**
 * Распознавание QR с файла в браузере (до отправки на сервер).
 * Порядок: нативный BarcodeDetector, ZXing WASM (barcode-detector / стек как у barqode), html5-qrcode, jsQR.
 */
import { Html5Qrcode } from "html5-qrcode";
import jsQR from "jsqr";
import { canonicalFnsQrraw } from "@/lib/fns-qr";

const DECODE_TIMEOUT_MS = 55_000;

function getNativeBarcodeDetector():
  | { detect: (image: ImageBitmapSource) => Promise<{ rawValue?: string }[]> }
  | null {
  if (typeof globalThis === "undefined") return null;
  const BD = (globalThis as unknown as {
    BarcodeDetector?: new (opts: { formats: string[] }) => {
      detect: (image: ImageBitmapSource) => Promise<{ rawValue?: string }[]>;
    };
  }).BarcodeDetector;
  if (!BD) return null;
  try {
    return new BD({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/** Запасной путь для термочеков, если Html5Qrcode не справился. */
async function tryJsQrFromFile(file: File): Promise<string | null> {
  if (typeof createImageBitmap === "undefined") return null;
  let bmp: ImageBitmap | null = null;
  try {
    bmp = await createImageBitmap(file);
    const max = 2000;
    let w = bmp.width;
    let h = bmp.height;
    if (w < 8 || h < 8) return null;
    if (w > max || h > max) {
      const scale = max / Math.max(w, h);
      w = Math.floor(w * scale);
      h = Math.floor(h * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    const tryDecode = (u8: Uint8ClampedArray) => jsQR(u8, w, h);
    let r = tryDecode(data.data);
    if (!r) {
      const inv = new Uint8ClampedArray(data.data.length);
      for (let i = 0; i < data.data.length; i += 4) {
        inv[i] = 255 - data.data[i];
        inv[i + 1] = 255 - data.data[i + 1];
        inv[i + 2] = 255 - data.data[i + 2];
        inv[i + 3] = 255;
      }
      r = tryDecode(inv);
    }
    if (!r?.data?.trim()) return null;
    return canonicalFnsQrraw(r.data.trim()) ?? null;
  } catch {
    return null;
  } finally {
    bmp?.close();
  }
}

let fileScanBoxCounter = 0;

/** Слишком крупные кадры с iPhone часто плохо детектятся и тормозят BarcodeDetector. */
const MAX_DETECT_EDGE = 2000;

async function imageBitmapScaledForDetect(file: File): Promise<ImageBitmap> {
  const src = await createImageBitmap(file);
  const iw = src.width;
  const ih = src.height;
  if (iw < 8 || ih < 8) {
    src.close();
    throw new Error("small image");
  }
  const edge = Math.max(iw, ih);
  if (edge <= MAX_DETECT_EDGE) return src;

  const scale = MAX_DETECT_EDGE / edge;
  const w = Math.floor(iw * scale);
  const h = Math.floor(ih * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    src.close();
    throw new Error("no ctx");
  }
  ctx.drawImage(src, 0, 0, w, h);
  src.close();
  const out = await createImageBitmap(canvas);
  return out;
}

/** Ponyfill ZXing (как у barqode: barcode-detector); если нет нативного API или он не прочитал QR. */
async function tryBarcodeDetectorPonyfillFromFile(file: File): Promise<string | null> {
  if (typeof createImageBitmap === "undefined") return null;
  let bmp: ImageBitmap | null = null;
  try {
    const { BarcodeDetector } = await import("barcode-detector/pure");
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    bmp = await imageBitmapScaledForDetect(file);
    const codes = await detector.detect(bmp);
    for (const c of codes) {
      const raw = typeof c.rawValue === "string" ? c.rawValue.trim() : "";
      if (raw) {
        const q = canonicalFnsQrraw(raw);
        if (q) return q;
      }
    }
  } catch {
    /* ignore */
  } finally {
    bmp?.close();
  }
  return null;
}

async function decodeQrFromImageFileInner(file: File): Promise<string | null> {
  const detector = getNativeBarcodeDetector();
  if (detector && typeof createImageBitmap !== "undefined") {
    let bmp: ImageBitmap | null = null;
    try {
      bmp = await imageBitmapScaledForDetect(file);
      try {
        const codes = await detector.detect(bmp);
        for (const c of codes) {
          const raw = c.rawValue?.trim();
          if (raw) {
            const q = canonicalFnsQrraw(raw);
            if (q) return q;
          }
        }
      } finally {
        bmp.close();
      }
    } catch {
      /* дальше ponyfill / html5 / jsQR */
    }
  }

  const fromPony = await tryBarcodeDetectorPonyfillFromFile(file);
  if (fromPony) return fromPony;

  const elId = `decode-qr-file-${++fileScanBoxCounter}`;
  const hidden = document.createElement("div");
  hidden.id = elId;
  /* Html5Qrcode иногда падает на контейнере 1×1; даём реальный размер вне экрана */
  hidden.setAttribute("aria-hidden", "true");
  hidden.style.cssText =
    "position:fixed;left:-3000px;top:0;width:640px;height:640px;overflow:hidden;pointer-events:none;";
  document.body.appendChild(hidden);
  try {
    const qr = new Html5Qrcode(elId, false);
    let decodedText: string | null = null;
    try {
      decodedText = await qr.scanFile(file, false);
    } catch {
      try {
        decodedText = await qr.scanFile(file, true);
      } catch {
        decodedText = null;
      }
    } finally {
      try {
        qr.clear();
      } catch {
        /* ignore */
      }
    }
    if (decodedText?.trim()) {
      const q = canonicalFnsQrraw(decodedText.trim());
      if (q) return q;
    }
  } finally {
    hidden.remove();
  }

  return tryJsQrFromFile(file);
}

/**
 * Возвращает каноническую строку qrraw или null.
 * Не бросает — внутренние сбои превращаются в null (кроме таймаута: тогда Error).
 */
export async function decodeQrFromImageFile(file: File): Promise<string | null> {
  try {
    return await withTimeout(
      decodeQrFromImageFileInner(file),
      DECODE_TIMEOUT_MS,
      "Распознавание слишком долгое — попробуйте фото меньшего размера или другое изображение."
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes("слишком долгое")) {
      throw e;
    }
    return null;
  }
}
