#!/usr/bin/env bash
# Поллер напоминаний: вызывает /api/alice/reminders/run-due на локальном инстансе.
# Запускается по cron раз в минуту, например:
#   * * * * * /home/shectory/workspaces/projects/ourdiary/scripts/run-reminders.sh >> /var/log/ourdiary-reminders.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."

# ALICE_SERVICE_SECRET берём из .env (строка ALICE_SERVICE_SECRET=...).
SECRET="$(grep -E '^ALICE_SERVICE_SECRET=' .env | head -n1 | cut -d= -f2- | tr -d "\"'\r")"
if [ -z "${SECRET:-}" ]; then
  echo "[run-reminders] ALICE_SERVICE_SECRET not found in .env" >&2
  exit 1
fi

PORT="$(grep -E '^PORT=' .env | head -n1 | cut -d= -f2- | tr -d "\"'\r")"
PORT="${PORT:-3002}"

curl -s -X POST \
  -H "Authorization: Bearer ${SECRET}" \
  "http://127.0.0.1:${PORT}/api/alice/reminders/run-due"
echo
