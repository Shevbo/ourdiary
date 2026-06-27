import { prisma } from "@/lib/prisma";
import { isExpired } from "@/lib/upload-token";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export const dynamic = "force-dynamic";

export default async function UploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  const record = await prisma.uploadToken.findUnique({
    where: { token },
    include: {
      event: {
        select: { title: true, date: true, category: { select: { name: true, color: true } } },
      },
    },
  });

  if (!record || isExpired(record.expiresAt)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Ссылка недействительна</h1>
        <p className="text-slate-500">
          Срок действия QR-кода истёк или он не найден. Попросите показать новый QR на экране ТВ.
        </p>
      </main>
    );
  }

  const ev = record.event;
  const color = ev.category?.color ?? "#6366f1";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-5">
      <header className="flex flex-col gap-1 rounded-2xl p-4 text-white" style={{ backgroundColor: color }}>
        <span className="text-sm opacity-90">Добавить в событие</span>
        <h1 className="text-2xl font-bold leading-tight">{ev.title}</h1>
        <span className="text-sm opacity-90">
          {format(new Date(ev.date), "d MMMM yyyy, HH:mm", { locale: ru })}
        </span>
      </header>

      {sp.ok === "1" && (
        <div className="rounded-xl bg-emerald-50 p-3 text-center text-emerald-700">
          Загружено. Можно добавить ещё.
        </div>
      )}

      <form
        action={`/api/u/${token}`}
        method="post"
        encType="multipart/form-data"
        className="flex flex-col gap-5"
      >
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Заметка</span>
          <textarea
            name="text"
            rows={3}
            placeholder="Напишите пару слов…"
            className="rounded-xl border border-slate-300 p-3 text-base outline-none focus:border-indigo-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Фото</span>
          <input
            type="file"
            name="photo"
            accept="image/*"
            capture="environment"
            className="text-base"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Видео</span>
          <input type="file" name="video" accept="video/*" className="text-base" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Подпись (необязательно)</span>
          <input
            type="text"
            name="caption"
            placeholder="Подпись к фото/видео"
            className="rounded-xl border border-slate-300 p-3 text-base outline-none focus:border-indigo-500"
          />
        </label>

        <button
          type="submit"
          className="rounded-xl bg-indigo-600 p-4 text-lg font-semibold text-white active:bg-indigo-700"
        >
          Загрузить
        </button>
      </form>

      <p className="text-center text-xs text-slate-400">
        Можно загрузить заметку, фото или видео — по отдельности или сразу. Видео до 100 МБ.
      </p>
    </main>
  );
}
