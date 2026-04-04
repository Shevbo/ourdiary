# RUNBOOK — Наш дневник (ourdiary)

## Запуск в режиме разработки

```bash
npm run dev
```

Приложение доступно на http://localhost:3000

> **Next.js 16.x**: граница авторизации настроена в `src/proxy.ts` (в этой версии файл `middleware.ts` переименован в соглашение `proxy`). Публичные пути: `/login`, `/security`, `/api/auth/*`, статика и каталог `/uploads/*`.

## Переменные окружения

Создайте файл `.env` в корне проекта:

```env
# База данных PostgreSQL (hoster)
DATABASE_URL="postgresql://user:password@host:5432/ourdiary"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Seed (опционально, для dev)
SEED_SUPERADMIN_PASSWORD="your-superadmin-password"

# Web Push (опционально; без этого блок «Уведомления» скрывается)
# Сгенерировать ключи: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
# Контакт для VAPID (рекомендуется mailto:)
VAPID_SUBJECT="mailto:admin@example.com"

# Прод: единый каталог Shectory (логин как на shectory.ru)
SHECTORY_AUTH_BRIDGE_SECRET="тот-же-секрет-что-на-портале"
SHECTORY_PORTAL_URL="https://shectory.ru"
AUTH_TRUST_HOST="true"
```

### Единый вход Shectory (каталог портала)

Если задан **`SHECTORY_AUTH_BRIDGE_SECRET`**, пароль проверяется на стороне портала (`POST /api/internal/verify-portal-credentials`), затем в локальной БД дневника выполняется **upsert** пользователя по email (роль синхронизируется с `portal_users.role`: `superadmin` → `SUPERADMIN`, `admin` → `ADMIN`, иначе `MEMBER`). Локальный `passwordHash` в дневнике для таких учёток не используется.

1. Сгенерировать секрет: `openssl rand -hex 32`
2. Добавить **одинаковое** значение в `.env` портала на VDS (`shectory-portal`) и в `.env` нашего дневника на hoster.
3. Перезапустить портал и процесс ourdiary (PM2).

Без секрета дневник по-прежнему пускает только локальные учётки из своей БД (удобно для dev).

## Импорт расходов по QR чека (ФНС)

Архитектура и варианты API: **`docs/fiscal-receipts.md`**.  
Для разбора **позиций** чека (не только общей суммы) задайте в `.env` **`PROVERKACHEKA_API_TOKEN`** (регистрация и токен на стороне сервиса проверки чеков, см. документ). Без токена создаётся **один** расход по сумме из параметра `s` в QR.

## Миграции базы данных

```bash
# Применить миграции
npx prisma migrate deploy

# Создать новую миграцию (dev)
npx prisma migrate dev --name migration-name
```

### Пустая база (первый раз на prod)

В репозитории есть **инкрементная** миграция (`SHOPPING_PLAN`, `push_subscriptions`), она **не создаёт** с нуля все таблицы. Если база **пустая**, однократно:

```bash
npx prisma migrate resolve --rolled-back "20250402120000_shopping_plan_and_push"   # если запись о «failed» уже есть
npx prisma db push
npx prisma migrate resolve --applied "20250402120000_shopping_plan_and_push"
```

Дальше на этом окружении используйте только `npx prisma migrate deploy` (как в `scripts/deploy.sh`).

## PM2 на hoster (стандартный порт)

Файл **`ecosystem.config.cjs`** в корне репозитория: приложение слушает **порт 3002** (на общем hoster порты 3000/3001 часто заняты).

```bash
cd ~/ourdiary
pm2 start ecosystem.config.cjs
pm2 save
```

Переопределить порт: `OURDIARY_PORT=3010 pm2 start ecosystem.config.cjs` (и обновить `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` под внешний URL).

## Seed — создание суперадмина

```bash
npx prisma db seed
```

Создаёт пользователя `bshevelev@mail.ru` с ролью `SUPERADMIN`.
Пароль берётся из `SEED_SUPERADMIN_PASSWORD` или `changeme-dev-only` (только для dev!).

## Сборка и запуск продакшн

```bash
npm run build
npm start
```

## Деплой (унифицированный Shectory)

```bash
# Из корня монолита CursorRPA на VDS (или с любой машины с SSH `hoster` + клоном CursorRPA):
/home/shectory/workspaces/CursorRPA/scripts/deploy-project.sh ourdiary hoster
```

Скрипт на hoster: **`scripts/deploy.sh`** — `git pull`, `NODE_ENV=development npm ci` (нужны devDependencies для `next build` / Tailwind), `prisma migrate deploy`, `npm run build`, перезапуск **PM2** `ourdiary`.

**Git (стандарт Shectory):** канонический `git_remote`, путь клона на VDS и правило SSH — в монолите `CursorRPA`: `docs/shectory-projects-registry.md` (строка **ourdiary**), подробнее — `docs/shectory-wikipedia.md` → раздел «Git remote и новый прикладной репозиторий», общее про commit/push перед деплоем — `docs/unified-deploy-ru.md`.

> **Первый деплой на hoster**: клон в **`$HOME/ourdiary`** (так ищет `deploy-project.sh`), `.env` с `DATABASE_URL` и NextAuth, затем один раз собрать и настроить перезапуск:
> `ssh hoster "git clone git@github.com:Shevbo/ourdiary.git ~/ourdiary"` (или HTTPS).
> На сервере перезапуск: **`pm2`** (процесс `ourdiary`) или user-unit **`OURDIARY_SYSTEMD_USER_UNIT`** при вызове `scripts/deploy.sh`.
> Локально скрипт: **`scripts/deploy.sh`** (выполняется на hoster после `git pull`).

## Внешний URL (ourdiary.shectory.ru)

Архитектура **не меняется**: Next.js по-прежнему слушает **только** `127.0.0.1:3002` (PM2), Postgres и секреты остаются в **`.env` на сервере**. Снаружи появляются **DNS + nginx + TLS** и правильные URL в `.env`.

1. **DNS**  
   Запись **A** (или **AAAA**) для `ourdiary.shectory.ru` должна указывать на **тот IP, где будет терминироваться HTTPS** — обычно это тот же хост, где крутится приложение (**hoster**), если nginx стоит там же. Если nginx на **VDS**, а Node на hoster — A-запись на VDS, а в `proxy_pass` используйте **внутренний** адрес hoster (см. комментарий в примере конфига).

2. **Nginx**  
   Шаблон: **`scripts/nginx-ourdiary.shectory.ru.conf.example`** — один `location /` с `proxy_pass` на upstream `127.0.0.1:3002` и заголовками `Host`, `X-Forwarded-For`, `X-Forwarded-Proto` (как у портала в `CursorRPA/scripts/nginx-shectory-portal.conf`). Не выносите в отдельный `alias` только часть `/_next/static/`.

3. **TLS**  
   На машине с nginx: `sudo apt install certbot python3-certbot-nginx`, затем `sudo certbot --nginx -d ourdiary.shectory.ru`. Certbot допишет `listen 443 ssl` и редирект с HTTP при необходимости.

4. **`.env` на сервере с приложением** (`~/ourdiary/.env`, в git не коммитить):

   ```env
   NEXTAUTH_URL="https://ourdiary.shectory.ru"
   NEXT_PUBLIC_APP_URL="https://ourdiary.shectory.ru"
   ```

   Остальное (`DATABASE_URL`, `NEXTAUTH_SECRET`, `PORT=3002`, VAPID при необходимости) — без изменений, если не меняете секреты.

5. **Перезапуск**  
   После правки `.env`: `pm2 restart ourdiary` (или как у вас назван процесс).

6. **Проверка**  
   Открыть `https://ourdiary.shectory.ru/login`, войти. Если NextAuth ругается на host за прокси — свериться с актуальной документацией NextAuth для вашей версии (часто достаточно корректного `NEXTAUTH_URL` и `X-Forwarded-Proto`).

## Структура приложения

| Маршрут | Описание |
|---------|----------|
| `/` | Лента событий |
| `/login` | Страница входа (стандарт Shectory) |
| `/calendar` | Календарь событий |
| `/expenses` | Учёт расходов семьи |
| `/tasks` | Задачи и обязанности |
| `/rating` | Рейтинг семьянина |
| `/tv` | TV-режим (75", автообновление 30 сек) |
| `/admin` | Управление пользователями (ADMIN/SUPERADMIN) |

## API-эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/events` | Список событий |
| POST | `/api/events` | Создать событие (+5 очков) |
| GET | `/api/events/[id]` | Детали события |
| POST | `/api/events/[id]/vote` | Голосование (+1 очко) |
| POST | `/api/events/[id]/comments` | Добавить комментарий |
| GET | `/api/expenses` | Список расходов |
| POST | `/api/expenses` | Добавить расход (+2 очка) |
| GET | `/api/tasks` | Список задач |
| POST | `/api/tasks` | Создать задачу (ADMIN+) |
| POST | `/api/tasks/[id]/complete` | Выполнить задачу (+points очков) |
| GET | `/api/rating` | Рейтинг участников |
| GET | `/api/users` | Список пользователей |
| PATCH | `/api/admin/users` | Изменить роль (ADMIN+) |
| POST | `/api/admin/users` | Создать пользователя (ADMIN+) |
| POST | `/api/upload/event-image` | Загрузка изображения события (multipart) |
| GET | `/api/push/vapid-public` | Публичный VAPID-ключ |
| POST | `/api/push/subscribe` | Сохранить Web Push-подписку |
| DELETE | `/api/push/subscribe?endpoint=…` | Удалить подписку |
