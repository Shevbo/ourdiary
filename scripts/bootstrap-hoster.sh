#!/usr/bin/env bash
# Однократная подготовка на сервере hoster по регламенту Shectory:
# роль и БД PostgreSQL, клон репозитория (если нет), .env с секретами, baseline схемы, seed, сборка, PM2.
# Запуск на hoster под пользователем с sudo для postgres (обычно ubuntu):
#   curl -fsSL ... | bash
# или скопировать репозиторий и выполнить: bash scripts/bootstrap-hoster.sh
#
# Не печатает секреты в stdout. Требует: git, node, npm, psql/sudo postgres, pm2.

set -euo pipefail

REPO_URL="${OURDIARY_REPO_URL:-https://github.com/Shevbo/ourdiary.git}"
TARGET="${OURDIARY_HOME:-$HOME/ourdiary}"
DB_NAME="${OURDIARY_DB_NAME:-ourdiary}"
DB_USER="${OURDIARY_DB_USER:-ourdiary_app}"
PORT="${OURDIARY_PORT:-3002}"

if [[ ! -d "$TARGET/.git" ]]; then
  git clone "$REPO_URL" "$TARGET"
fi

DB_PASS=$(openssl rand -hex 16)
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
fi
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;"

NEXTAUTH_SECRET=$(openssl rand -base64 32 | tr -d '\n')
umask 077
cat > "$TARGET/.env" <<EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}?schema=public"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
NEXTAUTH_URL="http://127.0.0.1:${PORT}"
PORT=${PORT}
NEXT_PUBLIC_APP_NAME="Наш дневник"
NEXT_PUBLIC_APP_URL="http://127.0.0.1:${PORT}"
EOF
chmod 600 "$TARGET/.env"

cd "$TARGET"
git pull --ff-only origin main || git pull origin main

if [[ -f "$HOME/.config/shectory/proxy.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$HOME/.config/shectory/proxy.env"
  set +a
fi

npm ci
npx prisma generate
set -a
# shellcheck disable=SC1090
source ./.env
set +a

if npx prisma migrate deploy 2>/dev/null; then
  echo "migrate deploy: ok"
else
  echo "migrate deploy: baseline empty DB (db push + resolve)"
  npx prisma migrate resolve --rolled-back "20250402120000_shopping_plan_and_push" 2>/dev/null || true
  npx prisma db push --accept-data-loss
  npx prisma migrate resolve --applied "20250402120000_shopping_plan_and_push"
fi

npx prisma db seed || { echo "seed: fallback tsx"; npx tsx prisma/seed.ts; }

npm run build

pm2 delete ourdiary 2>/dev/null || true
OURDIARY_PORT="$PORT" pm2 start ecosystem.config.cjs
pm2 save

echo "Готово: $TARGET , порт $PORT . Смените NEXTAUTH_URL при выставлении nginx."
