#!/usr/bin/env bash
# Копирует PDF на shectory-work по scp (ключ SSH, без пароля).
# Запускать на Linux/macOS там, где лежит файл: ./scripts/upload-documentation-api.sh /path/to/documentation_api.pdf
# Не путать с PowerShell: на Windows используйте upload-documentation-api.ps1
set -euo pipefail

LOCAL_PATH="${1:-}"
REMOTE_HOST="${REMOTE_HOST:-shectory-work}"
REMOTE_DIR="${REMOTE_DIR:-~/workspaces/ourdiary}"
REMOTE_NAME="${REMOTE_NAME:-documentation_api.pdf}"

if [[ -z "$LOCAL_PATH" || ! -f "$LOCAL_PATH" ]]; then
  echo "usage: $0 /path/to/documentation_api.pdf" >&2
  echo "  env: REMOTE_HOST (default: shectory-work) REMOTE_DIR REMOTE_NAME" >&2
  exit 1
fi

REMOTE_PATH="${REMOTE_DIR}/${REMOTE_NAME}"

echo "Локально:  $LOCAL_PATH"
echo "Удалённо:  ${REMOTE_HOST}:${REMOTE_PATH}"
scp "$LOCAL_PATH" "${REMOTE_HOST}:${REMOTE_PATH}"
echo "Готово."
