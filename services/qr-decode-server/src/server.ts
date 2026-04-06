import express from "express";
import multer from "multer";
import { decodeQrFromImageBuffer } from "../../../src/lib/decode-qr-from-buffer";

const host = process.env.QR_DECODE_HOST ?? "127.0.0.1";
const port = parseInt(process.env.QR_DECODE_PORT ?? "3912", 10);
const secret = process.env.QR_DECODE_SECRET?.trim() ?? "";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024 },
});

const app = express();

app.post("/decode", upload.single("file"), async (req, res) => {
  if (secret) {
    const h = req.headers["x-ourdiary-qr-secret"];
    if (h !== secret) {
      res.status(403).json({ error: "forbidden", text: null });
      return;
    }
  }
  const buf = req.file?.buffer;
  if (!buf?.length) {
    res.status(400).json({ error: "no file", text: null });
    return;
  }
  try {
    const text = await decodeQrFromImageBuffer(buf);
    res.json({ text: text ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "decode error";
    res.status(500).json({ error: msg, text: null });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, host, () => {
  console.log(`[qr-decode-server] http://${host}:${port} secret=${secret ? "on" : "off"}`);
});
