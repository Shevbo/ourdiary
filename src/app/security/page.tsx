import Link from "next/link";

export const metadata = {
  title: "Безопасность и поддержка — Наш дневник",
};

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 px-6 py-12 max-w-2xl mx-auto">
      <Link href="/login" className="text-indigo-600 dark:text-indigo-400 text-sm hover:underline">
        ← Ко входу
      </Link>
      <h1 className="text-2xl font-bold mt-8 mb-4">Безопасность и данные</h1>
      <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
        <p>
          Сессия хранится в защищённых HttpOnly-cookie (NextAuth, JWT). Пароли не хранятся в открытом виде —
          только хеш (bcrypt). Роли и права привязаны к идентификатору пользователя в каталоге Shectory, а не к
          email в логике доступа.
        </p>
        <p>
          Регистрация через открытую форму отключена: учётные записи создаются администратором семьи. Управление
          ролями доступно только в защищённой зоне администрирования.
        </p>
      </div>
      <h2 className="text-xl font-semibold mt-10 mb-3">Поддержка</h2>
      <p className="text-slate-700 dark:text-slate-300 text-sm">
        Вопросы по доступу и настройке семьи — через администратора проекта или контакт, указанный вашей
        организацией в экосистеме Shectory.
      </p>
    </div>
  );
}
