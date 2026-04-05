import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { loadInstructionMarkdown } from "@/lib/load-instruction";
import { APP_VERSION_DISPLAY } from "@/lib/app-version";

export const dynamic = "force-dynamic";

export default async function InstructionPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const md = await loadInstructionMarkdown();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-slate-900 dark:text-white text-2xl font-bold">Инструкция</h1>
        <div className="flex flex-wrap gap-2 text-sm">
          <a
            href="/api/instruction-file"
            download={`nash-dnevnik-instrukciya-${APP_VERSION_DISPLAY.replace(/\s+/g, "-")}.md`}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Скачать .md
          </a>
          <Link
            href="/me"
            className="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-500"
          >
            В кабинет
          </Link>
        </div>
      </div>
      <p className="text-slate-500 text-sm">Версия: {APP_VERSION_DISPLAY}</p>

      <article className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200">
        <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans">{md}</div>
      </article>
    </div>
  );
}
