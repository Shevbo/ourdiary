# RUNBOOK — Наш дневник (ourdiary)

## Запуск в режиме разработки

```bash
npm run dev
```

Приложение доступно на http://localhost:3000

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
```

## Миграции базы данных

```bash
# Применить миграции
npx prisma migrate deploy

# Создать новую миграцию (dev)
npx prisma migrate dev --name migration-name
```

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
