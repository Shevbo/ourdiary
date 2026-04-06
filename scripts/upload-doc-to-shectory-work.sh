#!/usr/bin/env bash
# Универсальная отправка любого файла на shectory-work в <проект>/docs/
#
# Интерактивно:
#   1) полный путь к локальному файлу;
#   2) номер проекта — каталоги из ~/workspaces на удалённой машине (или из списка-запаса).
#
# Неинтерактивно:
#   ./upload-doc-to-shectory-work.sh /path/to/file.pdf 3
#   ./upload-doc-to-shectory-work.sh /path/to/file.pdf 3 --yes   # без подтверждения
#
# Переменные окружения:
#   REMOTE_HOST              — SSH-хост (по умолчанию: shectory-work)
#   REMOTE_WORKSPACES        — подкаталог от $HOME на удалёнке (по умолчанию: workspaces → ~/workspaces)
#   SHECTORY_DOCS_PROJECTS_FILE — если задан и remote ls не сработал — имена проектов по строкам (пустые/# — пропуск)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE_HOST="${REMOTE_HOST:-shectory-work}"
REMOTE_WORKSPACES="${REMOTE_WORKSPACES:-workspaces}"
PROJECTS_FILE="${SHECTORY_DOCS_PROJECTS_FILE:-$SCRIPT_DIR/shectory-work-docs-projects.list}"

expand_local_path() {
  local p="$1"
  p="${p/#\~/$HOME}"
  if [[ ! -e "$p" ]]; then
    echo "Ошибка: нет такого пути: $p" >&2
    return 1
  fi
  if [[ ! -f "$p" ]]; then
    echo "Ошибка: это не обычный файл: $p" >&2
    return 1
  fi
  (cd "$(dirname "$p")" && printf "%s/%s\n" "$(pwd -P)" "$(basename "$p")")
}

load_projects_from_file() {
  local -a raw=()
  if [[ ! -f "$PROJECTS_FILE" ]]; then
    return 1
  fi
  mapfile -t raw < <(
    grep -v '^[[:space:]]*\(#\|$\)' "$PROJECTS_FILE" |
      sed 's/[[:space:]]*#.*//' |
      sed '/^$/d' |
      sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
  )
  [[ ${#raw[@]} -eq 0 ]] && return 1
  PROJECTS=("${raw[@]}")
}

load_projects_from_remote() {
  PROJECTS=()
  local line
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    [[ "$line" == .* ]] && continue
    PROJECTS+=("$line")
  done < <(
    ssh -q -o ConnectTimeout=12 -o BatchMode=no "$REMOTE_HOST" \
      "d=\"\$HOME/$REMOTE_WORKSPACES\"; [[ -d \"\$d\" ]] && ls -1 \"\$d\"" 2>/dev/null || true
  )
  [[ ${#PROJECTS[@]} -gt 0 ]]
}

load_projects() {
  if load_projects_from_remote; then
    echo "(Список каталогов с $REMOTE_HOST, ~/${REMOTE_WORKSPACES}/)" >&2
    return 0
  fi
  echo "Не удалось получить список по SSH; пробую файл $PROJECTS_FILE" >&2
  if load_projects_from_file; then
    return 0
  fi
  echo "Используется запасной вариант: только ourdiary." >&2
  PROJECTS=(ourdiary)
}

print_menu() {
  echo ""
  echo "Куда положить (папка docs внутри выбранного проекта на $REMOTE_HOST):"
  local i
  for i in "${!PROJECTS[@]}"; do
    printf "  %d) %s  →  ~/%s/%s/docs/\n" "$((i + 1))" "${PROJECTS[$i]}" "$REMOTE_WORKSPACES" "${PROJECTS[$i]}"
  done
  echo ""
}

SKIP_CONFIRM=0
ARGS=()
for a in "$@"; do
  if [[ "$a" == "--yes" || "$a" == "-y" ]]; then
    SKIP_CONFIRM=1
  else
    ARGS+=("$a")
  fi
done
set -- "${ARGS[@]}"

LOCAL_PATH=""
if [[ $# -ge 1 && -n "$1" ]]; then
  LOCAL_PATH="$(expand_local_path "$1")" || exit 1
else
  read -r -p "Полный путь к файлу для отправки: " input_path
  [[ -z "${input_path// }" ]] && echo "Путь пустой." >&2 && exit 1
  LOCAL_PATH="$(expand_local_path "$input_path")" || exit 1
fi

load_projects

choice=""
if [[ $# -ge 2 && -n "$2" ]]; then
  choice="$2"
else
  print_menu
  read -r -p "Номер проекта [1-${#PROJECTS[@]}]: " choice
fi

if ! [[ "$choice" =~ ^[0-9]+$ ]]; then
  echo "Ошибка: введите число от 1 до ${#PROJECTS[@]}." >&2
  exit 1
fi
if ((choice < 1 || choice > ${#PROJECTS[@]})); then
  echo "Ошибка: номер должен быть от 1 до ${#PROJECTS[@]}." >&2
  exit 1
fi

proj="${PROJECTS[$((choice - 1))]}"
base="$(basename "$LOCAL_PATH")"
REMOTE_SCP="${REMOTE_HOST}:~/${REMOTE_WORKSPACES}/${proj}/docs/${base}"

echo ""
echo "Локально:   $LOCAL_PATH"
echo "Удалённо:   $REMOTE_SCP"
echo ""

if [[ "$SKIP_CONFIRM" -eq 0 ]]; then
  read -r -p "Отправить? [y/N] " confirm
  if [[ ! "${confirm,,}" =~ ^y(es)?$ ]]; then
    echo "Отменено."
    exit 0
  fi
fi

ssh -q -o ConnectTimeout=12 "$REMOTE_HOST" "mkdir -p \"\$HOME/$REMOTE_WORKSPACES/$proj/docs\""
scp "$LOCAL_PATH" "$REMOTE_SCP"
echo "Готово."
