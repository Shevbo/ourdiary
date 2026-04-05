<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Shectory: каталог пользователей

Аутентификация «Наш дневник» на prod с `SHECTORY_AUTH_BRIDGE_SECRET`: приоритет **общий каталог портала** (`portal_users`); резерв — локальный `passwordHash` для учёток из админки дневника. Не отключать мост без согласования; не хранить отдельную «регистрацию» вместо каталога для тех, кто уже в портале.

## Git и деплой (обязательно для агента)

После **любой** завершённой задачи с изменениями кода или конфигурации репозитория:

1. **Коммит и push** в `main`: осмысленное сообщение на русском или английском, без секретов в diff.
2. **Деплой на prod** без напоминания пользователя:  
   `/home/shectory/workspaces/CursorRPA/scripts/deploy-project.sh ourdiary hoster`  
   (нужны SSH-алиасы `shectory-work` и `hoster`, см. `RUNBOOK.md` → «Деплой»). Скрипт при необходимости коммитит и пушит на **shectory-work**, затем на **hoster** выполняется `scripts/deploy.sh` (`git pull`, `npm ci`, `prisma migrate deploy`, `npm run build`, PM2 `ourdiary`).

Если SSH недоступен из среды агента — выполнить коммит и push локально и явно написать пользователю, что деплой нужно запустить вручную той же командой.
