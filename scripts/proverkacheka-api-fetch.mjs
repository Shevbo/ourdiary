#!/usr/bin/env node
/**
 * Вызов API proverkacheka.com (как в documentation_api.pdf).
 * Токен: PROVERKACHEKA_API_TOKEN в .env корня репозитория.
 *
 *   node scripts/proverkacheka-api-fetch.mjs
 *   node scripts/proverkacheka-api-fetch.mjs 't=20240409T1808&s=493.50&fn=...'
 *
 * Форматы из PDF: 1 — fn,fd,fp,t,n,s; 2 — qrraw; 3 — qrurl; 4 — qrfile (multipart).
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const token = process.env.PROVERKACHEKA_API_TOKEN?.trim();
if (!token) {
  console.error("Задайте PROVERKACHEKA_API_TOKEN в .env");
  process.exit(1);
}

const qrraw =
  process.argv[2]?.trim() ||
  "t=20240409T1808&s=493.50&fn=7284440500164805&i=45447&fp=2197607759&n=1";

const form = new FormData();
form.append("token", token);
form.append("qrraw", qrraw);

const url = "https://proverkacheka.com/api/v1/check/get";
const res = await fetch(url, {
  method: "POST",
  body: form,
  signal: AbortSignal.timeout(60_000),
});

const text = await res.text();
console.log("HTTP", res.status);
let data;
try {
  data = JSON.parse(text);
} catch {
  console.log(text.slice(0, 2000));
  process.exit(1);
}

console.log(JSON.stringify(data, null, 2));

if (data.code === 1 && data.data?.json?.items) {
  console.error("\n--- позиции (sum в копейках по спецификации) ---");
  for (const it of data.data.json.items) {
    const rub =
      typeof it.sum === "number" && Number.isInteger(it.sum)
        ? (it.sum / 100).toFixed(2)
        : String(it.sum);
    console.error("-", it.name, rub, "руб.");
  }
}
