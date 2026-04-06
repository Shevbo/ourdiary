# Сервис чтения QR с фото (sidecar)

## Почему не soulteary/nginx-qrcode-server

Репозиторий [soulteary/nginx-qrcode-server](https://github.com/soulteary/nginx-qrcode-server) использует **libqrencode** и **ngx_http_qrcode_module** — это **генерация** QR (текст в картинку), а не **чтение** QR с фото.

Сканирование снимка чека делаем отдельным процессом Node в этом репозитории: `services/qr-decode-server` (тот же алгоритм, что `src/lib/decode-qr-from-buffer.ts`: Sharp, ZBar WASM, ZXing, jsQR).

## Поток данных

1. Браузер: при импорте чека сначала клиент пытается прочитать QR (`src/lib/decode-qr-client.ts`: нативный BarcodeDetector, затем ZXing WASM из пакета `barcode-detector/pure` — тот же стек, что у [barqode](https://github.com/svecosystem/barqode), без Svelte). При успехе — `POST /api/expenses/from-receipt` с JSON `{ "qrraw": "..." }` без фото.
2. Иначе: `POST /api/expenses/from-receipt`, multipart поле `file`.
3. Next.js: `normalizeReceiptImageForApi` (HEIC/WebP при необходимости) → `preprocessReceiptImageForQrScan` (EXIF-rotate, max 4096 px по длинной стороне, JPEG, размер ~≤7 МБ).
4. Если задан `OURDIARY_QR_DECODE_URL` — POST подготовленного JPEG на sidecar `/decode`; иначе `decodeQrFromImageBuffer` в процессе Next.js.
5. Строка QR → канонизация → **ProverkaCheka только `qrraw`** (исходное фото в API проверки не шлём).

## PM2 на hoster

В `ecosystem.config.cjs` процесс **`ourdiary-qr-decode`**. В `.env`:

```
OURDIARY_QR_DECODE_URL=http://127.0.0.1:3912
OURDIARY_QR_DECODE_SECRET=случайная-длинная-строка
```

Проверка: `curl -s http://127.0.0.1:3912/health`

## API sidecar

- `POST /decode` — multipart `file`, ответ `{ "text": string | null }`.
- Заголовок `X-Ourdiary-Qr-Secret`, если задан секрет.
- Слушает **127.0.0.1** только.

## Nginx

`client_max_body_size` ≥ **32m** (см. `scripts/nginx-ourdiary.shectory.ru.conf.example`).
