"use client";

import { useEffect, useRef, useState, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Camera, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onClose: () => void;
  onReceiptPhoto: (file: File) => void | Promise<void>;
  receiptPhotoBusy?: boolean;
  serverUploadError?: string;
};

/**
 * Чек по фото: только выбор/съёмка через &lt;input type="file"&gt; (label htmlFor — надёжнее на iOS).
 * Распознавание QR — на сервере (ZBar/токен ProverkaCheka), не в браузере.
 */
export default function ReceiptQrScanner({
  onClose,
  onReceiptPhoto,
  receiptPhotoBusy,
  serverUploadError,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState("");
  const [portalReady, setPortalReady] = useState(false);

  const captureInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const captureInputId = useId().replace(/:/g, "");
  const galleryInputId = useId().replace(/:/g, "");

  const clearFileInputs = useCallback(() => {
    if (captureInputRef.current) captureInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }, []);

  const blocking = busy || !!receiptPhotoBusy;

  const handlePickedFile = useCallback(
    async (file: File | null) => {
      if (!file) {
        setFileError("Фото не получено. Попробуйте ещё раз или «Выбрать из медиатеки».");
        return;
      }
      if (!file.size) {
        setFileError("Пустой файл. Повторите снимок или выберите фото из медиатеки.");
        clearFileInputs();
        return;
      }
      setFileError("");
      setBusy(true);
      try {
        await Promise.resolve(onReceiptPhoto(file));
      } catch (e) {
        setFileError(e instanceof Error ? e.message : "Не удалось отправить фото");
      } finally {
        setBusy(false);
        clearFileInputs();
      }
    },
    [clearFileInputs, onReceiptPhoto]
  );

  function onFileInputEvent(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0] ?? null;
    void handlePickedFile(f);
  }

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const shell = (
    <div
      className="fixed inset-0 z-[9999] flex min-h-[100dvh] flex-col overflow-y-auto overscroll-contain bg-neutral-950/97 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 supports-[backdrop-filter]:backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-qr-scanner-title"
    >
      {blocking && (
        <div
          className="absolute inset-0 z-[70] flex flex-col items-center justify-center gap-2 bg-black/65 px-4"
          role="status"
          aria-live="polite"
        >
          <p className="text-center text-white text-sm font-medium">
            {receiptPhotoBusy ? "Импорт чека на сервере…" : "Подготовка фото…"}
          </p>
        </div>
      )}
      <div className="flex justify-end mb-1">
        <button
          type="button"
          onClick={onClose}
          disabled={blocking}
          className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 min-h-11 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          Закрыть
        </button>
      </div>

      <p id="receipt-qr-scanner-title" className="text-center text-base font-medium text-white mb-2">
        Чек по фото (ФНС)
      </p>

      <div className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border border-white/15 bg-white/5 p-5">
        <p className="text-center text-sm text-white/90">
          Снимок или фото из медиатеки отправляется на <strong className="text-white">сервер</strong> — QR читается там (не в браузере телефона).
        </p>
        <input
          id={`capture-${captureInputId}`}
          ref={captureInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={blocking}
          onChange={onFileInputEvent}
        />
        <input
          id={`gallery-${galleryInputId}`}
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={blocking}
          onChange={onFileInputEvent}
        />
        <label
          htmlFor={`capture-${captureInputId}`}
          className={cn(
            "inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white hover:bg-indigo-500",
            blocking && "pointer-events-none opacity-50"
          )}
        >
          <Camera className="h-5 w-5 shrink-0" />
          Снять чек камерой
        </label>
        <label
          htmlFor={`gallery-${galleryInputId}`}
          className={cn(
            "inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-base font-medium text-white hover:bg-white/15",
            blocking && "pointer-events-none opacity-50"
          )}
        >
          <ImageIcon className="h-5 w-5 shrink-0" />
          Выбрать из медиатеки
        </label>
        {serverUploadError ? <p className="text-center text-sm text-red-300">{serverUploadError}</p> : null}
        {fileError ? <p className="text-center text-sm text-amber-200">{fileError}</p> : null}
      </div>

      <p className="mt-auto pt-3 text-center text-[11px] text-white/45 px-2">
        Для строк позиций из ФНС на сервере нужен <strong className="text-white/70">PROVERKACHEKA_API_TOKEN</strong> в окружении хостинга.
        Без токена сервер пытается прочитать QR с фото (ZBar).
      </p>
    </div>
  );

  if (!portalReady || typeof document === "undefined") return null;
  return createPortal(shell, document.body);
}
