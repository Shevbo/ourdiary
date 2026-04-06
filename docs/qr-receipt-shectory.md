# QR: распознавание, проверка чеков и интеграция (экосистема Shectory)

Документ описывает, как в репозитории **ourdiary** («Наш дневник») устроены чтение QR с фискальных чеков РФ, передача распознанной строки в сервис проверки кассовых чеков (ProverkaCheka), сохранение в БД и переиспользование в других проектах Shectory.

См. также: [qr-decode-service.md](./qr-decode-service.md) (sidecar), [fiscal-receipts.md](./fiscal-receipts.md) (контекст ФНС и тарифы).

## 1. Назначение и границы

- В приложении цель — импорт расходов из QR чека ККТ: из строки QR извлекаются параметры ФНС (`t`, `s`, `fn`, `i`, `fp`, …), при наличии токена вызывается внешний API для позиций чека, иначе создаётся одна суммарная позиция по полю `s=`.
- Генерация QR-кодов (картинка из текста) в этом репозитории не реализована. Для кодирования QR другие сервисы используют библиотеки в своём стеке или готовые модули; не путать с чтением QR (см. [qr-decode-service.md](./qr-decode-service.md)).
- Публичного универсального микросервиса Shectory только для QR нет: распознавание встроено в Next.js и в опциональный sidecar на том же хосте.

## 2. Где лежат исходники

| Компонент | Путь | Роль |
|-----------|------|------|
| Клиент: чтение QR с файла | `src/lib/decode-qr-client.ts` | Нативный BarcodeDetector, затем `barcode-detector/pure` (ZXing WASM), html5-qrcode, jsQR; нормализация через `canonicalFnsQrraw` |
| UI импорта | `src/components/ReceiptQrScanner.tsx`, `src/components/ExpensesClient.tsx` | Сначала локальный декод, при успехе JSON на API; иначе multipart с фото |
| API импорта | `src/app/api/expenses/from-receipt/route.ts` | JSON `{ qrraw }` или multipart `file`; разбор; Proverkacheka; запись в БД |
| Парсинг фискальной строки | `src/lib/fns-qr.ts` | `parseFnsQrRaw`, `canonicalFnsQrraw`, дата из `t=` |
| Вызов ProverkaCheka | `src/lib/receipt-proverkacheka.ts` | `callProverkachekaCheck`, разбор ответа в строки чека |
| Токен из окружения | `src/lib/proverkacheka-env.ts` | `PROVERKACHEKA_API_TOKEN` или `PROVERKACHEKA_TOKEN` |
| Сервер: QR с буфера изображения | `src/lib/decode-qr-from-buffer.ts` | Sharp, ZBar WASM, ZXing, jsQR |
| Предобработка фото | `src/lib/receipt-qr-preprocess.ts`, `src/lib/receipt-image-normalize.ts` | Ориентация, лимит размера, JPEG |
| Вызов sidecar | `src/lib/qr-decode-sidecar.ts` | `OURDIARY_QR_DECODE_URL`, заголовок `X-Ourdiary-Qr-Secret` |
| Процесс sidecar | `services/qr-decode-server/src/server.ts` | `POST /decode` → `decodeQrFromImageBuffer` |
| PM2 | `ecosystem.config.cjs` | `ourdiary` и `ourdiary-qr-decode` |
| CLI отладки | `scripts/decode-qr-from-image.mjs` | `npm run decode-qr -- путь/к/фото.jpg` |

## 3. Поток распознанной строки до проверки чека

1. Клиент после выбора файла пытается получить каноническую строку `qrraw` локально (`decode-qr-client.ts`). Если получилось — `POST /api/expenses/from-receipt` с `Content-Type: application/json` и телом `{ "qrraw": "<строка>" }`.
2. Если локально не прочитано — тот же эндпоинт с `multipart/form-data`, поле `file`: на сервере нормализация и предобработка, затем при наличии URL — запрос к sidecar, иначе/затем `decodeQrFromImageBuffer` в процессе Next.js.
3. Строка нормализуется (`canonicalFnsQrraw`), парсится (`parseFnsQrRaw`). Без валидного разбора — ответ 400.
4. Если задан токен ProverkaCheka, вызывается `callProverkachekaCheck(token, { qrraw })`: `POST https://proverkacheka.com/api/v1/check/get`, поля формы `token` и `qrraw`. В сценарии импорта из текущего UI в ProverkaCheka уходит строка, не файл (поле `qrfile` в типах зарезервировано для других сценариев).
5. При успехе с позициями они маппятся в строки чека; иначе fallback по сумме из QR (`fallbackReceiptLinesFromFnsParams`).

Подробности sidecar: [qr-decode-service.md](./qr-decode-service.md). Контекст API: [fiscal-receipts.md](./fiscal-receipts.md).

## 4. База данных (Prisma / PostgreSQL)

Схема: `prisma/schema.prisma`.

- Таблица `expenses`: одна запись на импортированный чек (итоговая сумма, дата, примечание, место и т.д.).
- Таблица `expense_receipt_lines`: позиции чека, связь `expenseId` на родительский расход.
- Таблица `expense_places`: при необходимости создаётся или подставляется место из метаданных ответа ProverkaCheka.

Отдельной таблицы для сырого JSON чека или исходного QR в схеме нет; краткие метаданные попадают в `note`. Импорт выполняется в транзакции вместе с начислением рейтинга (`ratingPoint`).

## 5. Переменные окружения

| Переменная | Назначение |
|------------|------------|
| `PROVERKACHEKA_API_TOKEN` или `PROVERKACHEKA_TOKEN` | Доступ к API proverkacheka.com |
| `OURDIARY_QR_DECODE_URL` | Базовый URL sidecar, например `http://127.0.0.1:3912` |
| `OURDIARY_QR_DECODE_SECRET` | Секрет; Next передаёт `X-Ourdiary-Qr-Secret`, sidecar проверяет |
| `QR_DECODE_HOST`, `QR_DECODE_PORT`, `QR_DECODE_SECRET` | Для процесса `ourdiary-qr-decode` в `ecosystem.config.cjs` |

## 6. Другие проекты и службы Shectory

**Прямой вызов ProverkaCheka.** Любой сервис с собственным токеном может повторить контракт из `receipt-proverkacheka.ts`. Парсинг фискальной строки — из `fns-qr.ts`. Деплой ourdiary не обязателен.

**Чтение QR с картинки на Node.** Скопировать или вынести в пакет `decode-qr-from-buffer.ts` (sharp, zbar-wasm, zxing, jsqr) либо поднять `services/qr-decode-server` и звать его по HTTP по образцу `qr-decode-sidecar.ts`.

**Браузер.** Стек из `decode-qr-client.ts` переносится в другой фронтенд с учётом сборки, динамического import и CSP для WASM.

**Эндпоинт `/api/expenses/from-receipt`.** Это не открытый межсервисный API: нужна сессия пользователя приложения, результат пишется в БД ourdiary. Другим продуктам разумнее звать ProverkaCheka напрямую, вынести общую библиотеку в пакет или сделать отдельный gateway с своей авторизацией.

## 7. Сопровождение

При смене механики (декодеры, формат запроса, БД) обновляйте этот файл и при необходимости [qr-decode-service.md](./qr-decode-service.md) / [fiscal-receipts.md](./fiscal-receipts.md), чтобы описания не расходились.
