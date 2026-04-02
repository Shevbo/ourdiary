#!/usr/bin/env bash
set -euo pipefail

# Запуск на целевом сервере (hoster): из каталога клона репозитория ourdiary.
# Вызывается по SSH из CursorRPA: scripts/deploy-project.sh ourdiary hoster

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROXY_ENV="${SHECTORY_PROXY_ENV_PATH:-$HOME/.config/shectory/proxy.env}"
if [[ -f "$PROXY_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$PROXY_ENV"
  export HTTP_PROXY HTTPS_PROXY NO_PROXY http_proxy https_proxy no_proxy PIP_INDEX_URL PIP_EXTRA_INDEX_URL PIP_TRUSTED_HOST || true
fi

BRANCH="${OURDIARY_DEPLOY_BRANCH:-main}"

echo "=== ourdiary deploy ($(hostname)) ==="
echo "dir: $ROOT branch: $BRANCH"

git fetch origin
git checkout "$BRANCH"
git pull --ff-only "origin/$BRANCH" || git pull "origin" "$BRANCH"

if [[ -f package-lock.json ]]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi

npx prisma migrate deploy

npm run build

UNIT="${OURDIARY_SYSTEMD_USER_UNIT:-}"
if [[ -n "$UNIT" ]]; then
  if systemctl --user restart "$UNIT" 2>/dev/null; then
    echo "restart: systemctl --user $UNIT"
  else
    echo "warn: systemctl --user restart $UNIT не удался (нет юнита или не user-systemd)"
  fi
elif command -v pm2 &>/dev/null; then
  if pm2 describe ourdiary &>/dev/null; then
    echo "restart: pm2 ourdiary"
    pm2 restart ourdiary
  else
    echo "start: pm2 ourdiary (первый запуск)"
    pm2 start npm --name ourdiary -- start
  fi
  pm2 save 2>/dev/null || true
else
  echo "warn: задайте OURDIARY_SYSTEMD_USER_UNIT=имя.service или установите pm2; иначе перезапуск вручную: npm start"
fi

echo "=== ourdiary deploy done ==="
