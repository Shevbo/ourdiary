<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Shectory: каталог пользователей

Аутентификация «Наш дневник» на prod с `SHECTORY_AUTH_BRIDGE_SECRET`: приоритет **общий каталог портала** (`portal_users`); резерв — локальный `passwordHash` для учёток из админки дневника. Не отключать мост без согласования; не хранить отдельную «регистрацию» вместо каталога для тех, кто уже в портале.
