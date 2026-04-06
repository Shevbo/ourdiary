"use client";

import { useEffect, useRef, useState, useId } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, ImageIcon, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { canonicalFnsQrraw } from "@/lib/fns-qr";
import { decodeQrFromImageFile } from "@/lib/decode-qr-client";

type Props = {
  onDecoded: (qrraw: string) => void | Promise<void>;
  onClose: () => void;
  onReceiptPhoto?: (file: File) => void | Promise<void>;
  receiptPhotoBusy?: boolean;
  serverUploadError?: string;
};

const DETECT_INTERVAL_MS = 220;

function tryDecodeToQrraw(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  return canonicalFnsQrraw(t);
}

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

/**
 * Быстрый путь: нативная камера iOS/Android (`capture`) — затвор и предпросмотр ОС.
 * Дополнительно — лайв-скан (getUserMedia), на iPhone часто медленный и без «затвора».
 */
export default function ReceiptQrScanner({
  onDecoded,
  onClose,
  onReceiptPhoto,
  receiptPhotoBusy,
  serverUploadError,
}: Props) {
  const [tab, setTab] = useState<"quick" | "live">("quick");
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState("");
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [hint, setHint] = useState("");
  const [nativeStreaming, setNativeStreaming] = useState(false);

  const onDecodedRef = useRef(onDecoded);
  onDecodedRef.current = onDecoded;

  const captureInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastDetectAt = useRef(0);
  const html5Ref = useRef<Html5Qrcode | null>(null);

  const polyfillRootId = useId().replace(/:/g, "");

  async function handlePickedFile(file: File | null) {
    if (!file?.size) return;
    setFileError("");
    setLastFile(null);
    setBusy(true);
    try {
      const q = await decodeQrFromImageFile(file);
      if (q) {
        await Promise.resolve(onDecodedRef.current(q));
        return;
      }
      setLastFile(file);
      setFileError(
        "QR на снимке не распознан. Снимите крупнее или отправьте фото на сервер (если задан токен ProverkaCheka)."
      );
    } catch (e) {
      setLastFile(file);
      setFileError(e instanceof Error ? e.message : "Не удалось обработать изображение");
    } finally {
      setBusy(false);
      if (captureInputRef.current) captureInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  /** Лайв-камера: только по вкладке «Непрерывно» — на iPhone не используем по умолчанию. */
  useEffect(() => {
    if (tab !== "live") return;

    let cancelled = false;
    const detector = getNativeBarcodeDetector();
    const canvas = document.createElement("canvas");

    async function runNative() {
      const video = videoRef.current;
      if (!video || !detector) return false;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return true;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();
        setNativeStreaming(true);
        setHint("");

        const tick = async () => {
          if (cancelled) return;
          const now = performance.now();
          if (now - lastDetectAt.current < DETECT_INTERVAL_MS) {
            rafRef.current = requestAnimationFrame(() => void tick());
            return;
          }
          lastDetectAt.current = now;
          const w = video.videoWidth;
          const h = video.videoHeight;
          if (w > 32 && h > 32) {
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0);
              try {
                const codes = await detector.detect(canvas);
                for (const c of codes) {
                  const q = tryDecodeToQrraw(c.rawValue ?? "");
                  if (q) {
                    stream.getTracks().forEach((t) => t.stop());
                    onDecodedRef.current(q);
                    return;
                  }
                }
              } catch {
                /* frame */
              }
            }
          }
          rafRef.current = requestAnimationFrame(() => void tick());
        };
        rafRef.current = requestAnimationFrame(() => void tick());
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setHint(/Permission|NotAllowed|NotFound/i.test(msg) ? "Нет доступа к камере." : "Камера недоступна.");
        return false;
      }
    }

    async function runPolyfillCamera() {
      const elId = `qr-polyfill-${polyfillRootId}`;
      const root = document.getElementById(elId);
      if (!root) return;
      try {
        const qr = new Html5Qrcode(elId, false);
        html5Ref.current = qr;
        await qr.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
          (decodedText) => {
            const q = tryDecodeToQrraw(decodedText);
            if (q) {
              void qr.stop().catch(() => {});
              onDecodedRef.current(q);
            }
          },
          () => {}
        );
        setHint("");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setHint(msg.includes("NotAllowed") ? "Нет доступа к камере." : "Не удалось запустить камеру.");
      }
    }

    void (async () => {
      if (detector) {
        const ok = await runNative();
        if (ok || cancelled) return;
      }
      if (cancelled) return;
      await runPolyfillCamera();
    })();

    return () => {
      cancelled = true;
      setNativeStreaming(false);
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      const h = html5Ref.current;
      html5Ref.current = null;
      if (h) {
        void h.stop().catch(() => {});
        try {
          h.clear();
        } catch {
          /* ignore */
        }
      }
    };
  }, [tab, polyfillRootId]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90 backdrop-blur-sm p-3 sm:p-4 relative">
      {(busy || receiptPhotoBusy) && (
        <div
          className="absolute inset-0 z-[70] flex flex-col items-center justify-center gap-2 bg-black/65 px-4"
          role="status"
          aria-live="polite"
        >
          <p className="text-center text-white text-sm font-medium">
            {receiptPhotoBusy ? "Импорт чека в расходы…" : "Распознавание QR…"}
          </p>
        </div>
      )}
      <div className="flex justify-end mb-1">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 min-h-11"
        >
          <X className="h-4 w-4" />
          Закрыть
        </button>
      </div>

      <p className="text-center text-base font-medium text-white mb-2">Чек по QR (ФНС)</p>

      <div className="mx-auto mb-3 flex max-w-md rounded-xl border border-white/20 bg-white/10 p-1 w-full">
        <button
          type="button"
          onClick={() => {
            setTab("quick");
            setFileError("");
            setHint("");
          }}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-11",
            tab === "quick" ? "bg-white text-slate-900" : "text-white/90 hover:bg-white/10"
          )}
        >
          <Camera className="h-4 w-4 shrink-0" />
          Снимок
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("live");
            setFileError("");
          }}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-11",
            tab === "live" ? "bg-white text-slate-900" : "text-white/90 hover:bg-white/10"
          )}
        >
          <Zap className="h-4 w-4 shrink-0" />
          Непрерывно
        </button>
      </div>

      {tab === "quick" && (
        <div className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border border-white/15 bg-white/5 p-5">
          <p className="text-center text-sm text-white/90">
            Откройте <strong className="text-white">штатную камеру</strong> с кнопкой затвора — так быстрее всего на iPhone.
          </p>
          <input
            ref={captureInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={busy}
            onChange={(e) => void handlePickedFile(e.target.files?.[0] ?? null)}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => void handlePickedFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => captureInputRef.current?.click()}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            <Camera className="h-5 w-5 shrink-0" />
            {busy ? "Распознаём…" : "Снять QR камерой"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => galleryInputRef.current?.click()}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-base font-medium text-white hover:bg-white/15 disabled:opacity-50"
          >
            <ImageIcon className="h-5 w-5 shrink-0" />
            Выбрать из медиатеки
          </button>
          {serverUploadError ? <p className="text-center text-sm text-red-300">{serverUploadError}</p> : null}
          {fileError && (
            <div className="flex flex-col gap-3">
              <p className="text-center text-sm text-amber-200">{fileError}</p>
              {onReceiptPhoto && lastFile && (
                <button
                  type="button"
                  disabled={!!receiptPhotoBusy}
                  onClick={() => void onReceiptPhoto(lastFile)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-600/90 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {receiptPhotoBusy ? "Отправка…" : "Отправить фото на сервер"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "live" && (
        <div className="flex flex-1 flex-col min-h-0">
          <p className="text-center text-xs text-amber-100/90 mb-2 px-2">
            На iPhone этот режим может быть медленным. Предпочтительнее вкладка «Снимок».
          </p>
          <div className="relative mx-auto w-full max-w-md flex-1 min-h-[40vh] rounded-xl overflow-hidden bg-black border border-white/10">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover z-0"
              playsInline
              muted
              autoPlay
            />
            <div
              id={`qr-polyfill-${polyfillRootId}`}
              className={cn(
                "absolute inset-0 w-full h-full min-h-[280px] z-[1]",
                nativeStreaming && "pointer-events-none opacity-0"
              )}
            />
          </div>
          {hint ? <p className="text-center text-sm text-amber-200 mt-2 px-2">{hint}</p> : null}
        </div>
      )}

      <p className="mt-auto pt-3 text-center text-[11px] text-white/45 px-2">
        Строка QR обрабатывается на устройстве и на сервере без лишней передачи изображения. Для позиций из ФНС нужен токен в
        окружении <strong className="text-white/70">хостинга</strong> (не только в локальном .env).
      </p>
    </div>
  );
}
