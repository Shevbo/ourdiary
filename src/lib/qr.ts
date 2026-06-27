import QRCode from "qrcode";

/**
 * Генерирует QR-код как data:image/png;base64 dataURL на сервере.
 * Возвращает null при пустом значении или ошибке (страница просто не покажет QR).
 */
export async function qrDataUrl(value: string): Promise<string | null> {
  if (!value) return null;
  try {
    return await QRCode.toDataURL(value, {
      margin: 1,
      width: 256,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    });
  } catch {
    return null;
  }
}
