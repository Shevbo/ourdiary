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
```

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
# Из корня монолита CursorRPA на VDS:
/home/shectory/workspaces/CursorRPA/scripts/deploy-project.sh ourdiary hoster
```

**Git (стандарт Shectory):** канонический `git_remote`, путь клона на VDS и правило SSH — в монолите `CursorRPA`: `docs/shectory-projects-registry.md` (строка **ourdiary**), подробнее — `docs/shectory-wikipedia.md` → раздел «Git remote и новый прикладной репозиторий», общее про commit/push перед деплоем — `docs/unified-deploy-ru.md`.

> **Первый деплой на hoster**: клон в **`$HOME/ourdiary`** (так ищет `deploy-project.sh`), `.env` с `DATABASE_URL` и NextAuth, затем один раз собрать и настроить перезапуск:
> `ssh hoster "git clone git@github.com:Shevbo/ourdiary.git ~/ourdiary"` (или HTTPS).
> На сервере перезапуск: **`pm2`** (процесс `ourdiary`) или user-unit **`OURDIARY_SYSTEMD_USER_UNIT`** при вызове `scripts/deploy.sh`.
> Локально скрипт: **`scripts/deploy.sh`** (выполняется на hoster после `git pull`).

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
