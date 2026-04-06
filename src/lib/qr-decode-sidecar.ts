export async function decodeQrViaSidecar(buffer: Buffer, mime: string): Promise<string | null> {
  const base = process.env.OURDIARY_QR_DECODE_URL?.trim();
  if (!base) return null;

  const secret = process.env.OURDIARY_QR_DECODE_SECRET?.trim() ?? "";
  const url = `${base.replace(/\/$/, "")}/decode`;

  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: mime || "image/jpeg" });
  form.append("file", blob, "receipt.jpg");

  const headers = new Headers();
  if (secret) headers.set("X-Ourdiary-Qr-Secret", secret);

  try {
    const res = await fetch(url, {
      method: "POST",
      body: form,
      headers,
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { text?: string | null };
    const t = typeof j.text === "string" ? j.text.trim() : "";
    return t || null;
  } catch {
    return null;
  }
}
