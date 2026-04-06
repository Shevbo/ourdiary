"use client";

/**
 * Распознавание QR с файла в браузере (до отправки на сервер).
 */
import { Html5Qrcode } from "html5-qrcode";
import { canonicalFnsQrraw } from "@/lib/fns-qr";

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

/** Стабильный id для скрытого контейнера Html5Qrcode.scanFile. */
let fileScanBoxCounter = 0;

/**
 * Возвращает каноническую строку qrraw или null.
 */
export async function decodeQrFromImageFile(file: File): Promise<string | null> {
  const detector = getNativeBarcodeDetector();
  if (detector && typeof createImageBitmap !== "undefined") {
    try {
      const bmp = await createImageBitmap(file);
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
      /* fallback */
    }
  }

  const elId = `decode-qr-file-${++fileScanBoxCounter}`;
  const hidden = document.createElement("div");
  hidden.id = elId;
  hidden.className = "sr-only";
  hidden.setAttribute("aria-hidden", "true");
  document.body.appendChild(hidden);
  try {
    const qr = new Html5Qrcode(elId, false);
    let decodedText: string | null = null;
    try {
      decodedText = await qr.scanFile(file, false);
    } catch {
      decodedText = await qr.scanFile(file, true);
    } finally {
      try {
        qr.clear();
      } catch {
        /* ignore */
      }
    }
    if (decodedText?.trim()) {
      return canonicalFnsQrraw(decodedText.trim()) ?? null;
    }
  } finally {
    hidden.remove();
  }
  return null;
}
