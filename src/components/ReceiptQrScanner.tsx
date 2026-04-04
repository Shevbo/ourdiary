"use client";

import { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { X } from "lucide-react";

type Props = {
  onDecoded: (raw: string) => void;
  onClose: () => void;
};

export default function ReceiptQrScanner({ onDecoded, onClose }: Props) {
  const onDecodedRef = useRef(onDecoded);
  onDecodedRef.current = onDecoded;
  const containerIdRef = useRef<string | null>(null);
  if (!containerIdRef.current) {
    containerIdRef.current = `receipt-qr-${Math.random().toString(36).slice(2, 11)}`;
  }

  useEffect(() => {
    const elId = containerIdRef.current!;
    const scanner = new Html5QrcodeScanner(
      elId,
      { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
      /* verbose */ false
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
  }, []);

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
      <p className="text-center text-sm text-white/90 mb-3">Наведите камеру на QR-код чека</p>
      <div id={containerIdRef.current} className="mx-auto w-full max-w-md rounded-xl overflow-hidden bg-black" />
    </div>
  );
}
