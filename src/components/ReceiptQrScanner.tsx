"use client";

import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import { X, Camera, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onDecoded: (raw: string) => void;
  onClose: () => void;
};

type ScanMode = "camera" | "file";

export default function ReceiptQrScanner({ onDecoded, onClose }: Props) {
  const [mode, setMode] = useState<ScanMode>("camera");
  const [fileError, setFileError] = useState("");
  const [scanningFile, setScanningFile] = useState(false);
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

  async function scanFromImageFile(file: File | null) {
    if (!file || file.size === 0) return;
    setFileError("");
    setScanningFile(true);
    const elId = fileReaderIdRef.current;
    let qr: Html5Qrcode | null = null;
    try {
      qr = new Html5Qrcode(elId, false);
      const decodedText = await qr.scanFile(file, false);
      if (decodedText?.trim()) {
        onDecodedRef.current(decodedText.trim());
        return;
      }
      setFileError("QR не найден на изображении.");
    } catch {
      setFileError(
        "Не удалось распознать QR на фото. Сделайте фото чётче, при хорошем свете, или используйте режим «Камера»."
      );
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
            Выберите снимок чека из галереи — мы попробуем прочитать QR с фотографии.
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
          {fileError && <p className="text-center text-sm text-amber-200">{fileError}</p>}
        </div>
      )}

      {/* Контейнер для Html5Qrcode.scanFile (должен быть в DOM) */}
      <div id={fileReaderIdRef.current} className="sr-only" aria-hidden />

      <p className="mt-auto pt-4 text-center text-xs text-white/50 px-2">
        После сканирования расходы подставятся по данным чека (нужен токен API на сервере для позиций).
      </p>
    </div>
  );
}
