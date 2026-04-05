"use client";

import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import { X, Camera, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onDecoded: (raw: string) => void;
  onClose: () => void;
  /** Если локальный QR не прочитался — отправка того же файла на сервер (qrfile → ProverkaCheka). */
  onReceiptPhoto?: (file: File) => void | Promise<void>;
  /** Блокировка кнопки «на сервер», пока идёт запрос */
  receiptPhotoBusy?: boolean;
  /** Ошибка от POST /api/expenses/from-receipt (видна поверх модалки) */
  serverUploadError?: string;
};

type ScanMode = "camera" | "file";

export default function ReceiptQrScanner({
  onDecoded,
  onClose,
  onReceiptPhoto,
  receiptPhotoBusy,
  serverUploadError,
}: Props) {
  const [mode, setMode] = useState<ScanMode>("camera");
  const [fileError, setFileError] = useState("");
  const [scanningFile, setScanningFile] = useState(false);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const onDecodedRef = useRef(onDecoded);
  onDecodedRef.current = onDecoded;

  const cameraContainerIdRef = useRef<string | null>(null);
  if (!cameraContainerIdRef.current) {
    cameraContainerIdRef.current = `receipt-qr-cam-${Math.random().toString(36).slice(2, 11)}`;
  }

  const fileReaderIdRef = useRef(`receipt-qr-file-${Math.random().toString(36).slice(2, 11)}`);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode !== "camera") return;
    const elId = cameraContainerIdRef.current!;
    const scanner = new Html5QrcodeScanner(
      elId,
      { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
      false
    );

    scanner.render(
      (decodedText) => {
        if (!decodedText?.trim()) return;
        const t = decodedText.trim();
        scanner.clear().catch(() => {});
        onDecodedRef.current(t);
      },
      () => {}
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [mode]);

  function friendlyScanError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    if (/No MultiFormat Readers|not found|Unable to decode/i.test(msg)) {
      return "На этом снимке библиотека на телефоне не увидела QR (так бывает с фото из галереи).";
    }
    return "Не удалось распознать QR на фото. Попробуйте режим «Камера» или кнопку ниже.";
  }

  async function scanFromImageFile(file: File | null) {
    if (!file || file.size === 0) return;
    setFileError("");
    setLastFile(null);
    setScanningFile(true);
    const elId = fileReaderIdRef.current;
    let qr: Html5Qrcode | null = null;
    try {
      qr = new Html5Qrcode(elId, false);
      let decodedText: string | null = null;
      try {
        decodedText = await qr.scanFile(file, false);
      } catch (firstErr) {
        try {
          decodedText = await qr.scanFile(file, true);
        } catch {
          throw firstErr;
        }
      }
      if (decodedText?.trim()) {
        onDecodedRef.current(decodedText.trim());
        return;
      }
      setLastFile(file);
      setFileError("QR не найден на изображении.");
    } catch (err) {
      setLastFile(file);
      setFileError(friendlyScanError(err));
    } finally {
      try {
        qr?.clear();
      } catch {
        /* ignore */
      }
      setScanningFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function sendFileToServer() {
    if (!lastFile || !onReceiptPhoto) return;
    await onReceiptPhoto(lastFile);
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/80 backdrop-blur-sm p-4">
      <div className="flex justify-end mb-2">
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

      <div className="mx-auto mb-4 flex max-w-md rounded-xl border border-white/20 bg-white/10 p-1">
        <button
          type="button"
          onClick={() => {
            setMode("camera");
            setFileError("");
          }}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-11",
            mode === "camera" ? "bg-white text-slate-900" : "text-white/90 hover:bg-white/10"
          )}
        >
          <Camera className="h-4 w-4 shrink-0" />
          Камера
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("file");
            setFileError("");
          }}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-11",
            mode === "file" ? "bg-white text-slate-900" : "text-white/90 hover:bg-white/10"
          )}
        >
          <ImageIcon className="h-4 w-4 shrink-0" />
          Фото из галереи
        </button>
      </div>

      {mode === "camera" && (
        <>
          <p className="text-center text-sm text-white/90 mb-3 px-2">
            Наведите камеру на QR-код на чеке (как в кассе — квадратный штрихкод).
          </p>
          <div
            id={cameraContainerIdRef.current}
            className="mx-auto w-full max-w-md rounded-xl overflow-hidden bg-black"
          />
        </>
      )}

      {mode === "file" && (
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-white/15 bg-white/5 p-6">
          <p className="text-center text-sm text-white/90">
            Выберите снимок чека из галереи — сначала читаем QR на устройстве. Если не получится и на сервере задан токен
            ProverkaCheka, можно отправить то же фото на сервер — там QR распознаётся отдельно.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={scanningFile}
            onChange={(e) => void scanFromImageFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={scanningFile}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-11 w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            <ImageIcon className="h-5 w-5 shrink-0" />
            {scanningFile ? "Распознаём…" : "Выбрать изображение"}
          </button>
          {serverUploadError ? (
            <p className="text-center text-sm text-red-300">{serverUploadError}</p>
          ) : null}
          {fileError && (
            <div className="flex w-full flex-col gap-3">
              <p className="text-center text-sm text-amber-200">{fileError}</p>
              {onReceiptPhoto && lastFile && (
                <button
                  type="button"
                  disabled={!!receiptPhotoBusy}
                  onClick={() => void sendFileToServer()}
                  className="inline-flex min-h-11 w-full max-w-xs items-center justify-center gap-2 self-center rounded-lg border border-emerald-400/50 bg-emerald-600/90 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {receiptPhotoBusy ? "Отправка…" : "Отправить это фото на сервер"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Контейнер для Html5Qrcode.scanFile (должен быть в DOM) */}
      <div id={fileReaderIdRef.current} className="sr-only" aria-hidden />

      <p className="mt-auto pt-4 text-center text-xs text-white/50 px-2">
        Для строк по чеку нужен PROVERKACHEKA_API_TOKEN на сервере. Если галерея не читает QR — «Отправить фото на сервер».
      </p>
    </div>
  );
}
