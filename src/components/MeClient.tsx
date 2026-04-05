"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { DarumaIcon, DREAM_STATUS_LABEL } from "./DarumaStatus";
import AvatarImg from "./AvatarImg";
import { LogOut, User, Bell, Sparkles, Wallet, Info } from "lucide-react";
import SembonIcon from "@/components/SembonIcon";
import { cn } from "@/lib/utils";
import { APP_VERSION_DISPLAY } from "@/lib/app-version";
import { AVATAR_TARGET_MAX_BYTES, compressImageToJpegFile } from "@/lib/avatar-compress";

type Profile = {
  id: string;
  loginName: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  bioNote: string | null;
  unreadNotifications: number;
};

type Notif = {
  id: string;
  title: string;
  body: string;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

type DreamShelf = {
  id: string;
  orderNo: number;
  shortTitle: string;
  status: string;
  authorId: string;
};

export default function MeClient() {
  const { update: updateSession } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bioNote, setBioNote] = useState("");
  const [password, setPassword] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [myDreams, setMyDreams] = useState<DreamShelf[]>([]);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  useEffect(() => {
    void (async () => {
      const me = await fetch("/api/me");
      if (!me.ok) return;
      const p = (await me.json()) as Profile;
      setProfile(p);
      setName(p.name ?? "");
      setEmail(p.email);
      setBioNote(p.bioNote ?? "");

      const n = await fetch("/api/notifications?take=30");
      if (n.ok) {
        const j = (await n.json()) as { items: Notif[] };
        setNotifs(j.items);
      }

      const dr = await fetch("/api/dreams");
      if (dr.ok) {
        const all = (await dr.json()) as DreamShelf[];
        setMyDreams(all.filter((x) => x.authorId === p.id));
      }
    })();
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || null,
          email,
          bioNote: bioNote || null,
          ...(password ? { password } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data.error as string) ?? "Ошибка");
        return;
      }
      setPassword("");
      const me2 = await fetch("/api/me");
      if (me2.ok) setProfile(await me2.json());
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0] ?? null;
    if (!file || file.size === 0) return;

    setAvatarError("");
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);

    setUploading(true);
    try {
      const compressed = await compressImageToJpegFile(file, AVATAR_TARGET_MAX_BYTES);
      const fd = new FormData();
      fd.append("file", compressed);
      const res = await fetch("/api/upload/avatar", { method: "POST", body: fd });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setAvatarError(data.error ?? "Не удалось загрузить фото");
        URL.revokeObjectURL(localUrl);
        setAvatarPreview(null);
        return;
      }
      if (data.url) {
        try {
          await updateSession({ image: data.url });
        } catch {
          /* сессия NextAuth могла не обновиться */
        }
      }
      URL.revokeObjectURL(localUrl);
      setAvatarPreview(null);
      const me2 = await fetch("/api/me");
      if (me2.ok) setProfile(await me2.json());
      router.refresh();
      window.dispatchEvent(new CustomEvent("ourdiary-profile-updated"));
    } catch (err) {
      setAvatarError(
        err instanceof Error && err.message.includes("прочитать")
          ? "Формат не поддерживается. Выберите JPG, PNG или WebP."
          : "Не удалось обработать фото. Попробуйте другой файл."
      );
      URL.revokeObjectURL(localUrl);
      setAvatarPreview(null);
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  async function markRead(id: string, link?: string | null) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    const me2 = await fetch("/api/me");
    if (me2.ok) setProfile(await me2.json());
    const n2 = await fetch("/api/notifications?take=30");
    if (n2.ok) setNotifs((await n2.json() as { items: Notif[] }).items);
    if (link) router.push(link);
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    const me2 = await fetch("/api/me");
    if (me2.ok) setProfile(await me2.json());
    const n2 = await fetch("/api/notifications?take=30");
    if (n2.ok) setNotifs((await n2.json() as { items: Notif[] }).items);
  }

  if (!profile) {
    return <div className="text-slate-500 py-12 text-center">Загрузка…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-slate-900 dark:text-white text-2xl font-bold flex items-center gap-2">
          <User className="w-7 h-7 text-indigo-500" />
          Личный кабинет
        </h1>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 flex items-center gap-1"
        >
          <LogOut className="w-4 h-4" /> Выйти
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/80">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
          <Info className="h-4 w-4 text-indigo-500" />
          О системе
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
          <strong className="text-slate-800 dark:text-slate-200">Наш дневник</strong> — версия{" "}
          <span className="font-mono text-indigo-600 dark:text-indigo-400">{APP_VERSION_DISPLAY}</span>. Лента событий,
          календарь, расходы с фото и чеками, сембоны, задачи, мечты и режим TV для большого экрана.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/instruction"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Открыть инструкцию
          </Link>
          <a
            href="/api/instruction-file"
            download
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-900/40"
          >
            Скачать инструкцию (.md)
          </a>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/80">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Отчёты</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/rating"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/40"
          >
            <SembonIcon className="h-5 w-5" title="Сембоны" />
            Сембоны
          </Link>
          <Link
            href="/expenses"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/40"
          >
            <Wallet className="h-4 w-4 text-emerald-500" />
            Расходы (план / факт)
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Профиль</h2>
        <div className="flex gap-4 mb-4">
          <div className="shrink-0">
            <AvatarImg
              src={avatarPreview ?? profile.avatarUrl}
              alt=""
              name={profile.name ?? profile.loginName}
              size="xl"
            />
            {uploading && (
              <p className="mt-1 text-center text-[11px] text-slate-500">Отправка…</p>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs text-slate-500 block mb-1">Фото</span>
            <label className="relative inline-flex min-h-[44px] min-w-[160px] cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                disabled={uploading}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                onChange={(e) => void handleAvatarFileChange(e)}
              />
              {uploading ? "Загрузка…" : "Выбрать файл"}
            </label>
            <p className="text-xs text-slate-500 mt-2">
              Сразу показывается превью; перед отправкой сжимаем до ~330 КБ (JPEG). Исходник до 5 МБ.
            </p>
            {avatarError && <p className="text-xs text-red-600 mt-1">{avatarError}</p>}
          </div>
        </div>

        <form onSubmit={saveProfile} className="space-y-3 max-w-md">
          <div>
            <label className="text-xs text-slate-500">Имя для входа</label>
            <p className="text-slate-900 dark:text-white text-sm">{profile.loginName}</p>
          </div>
          <div>
            <label className="text-xs text-slate-500">Имя</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Заметки о себе</label>
            <textarea
              value={bioNote}
              onChange={(e) => setBioNote(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Новый пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="не менять — оставьте пустым"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className={cn("rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white", saving && "opacity-60")}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </form>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Уведомления
            {profile.unreadNotifications > 0 && (
              <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full">
                {profile.unreadNotifications}
              </span>
            )}
          </h2>
          {notifs.some((n) => !n.readAt) && (
            <button type="button" onClick={() => void markAllRead()} className="text-xs text-indigo-600">
              Прочитать все
            </button>
          )}
        </div>
        <ul className="space-y-2">
          {notifs.length === 0 && <li className="text-slate-500 text-sm">Нет уведомлений</li>}
          {notifs.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => void markRead(n.id, n.linkUrl)}
                className={cn(
                  "w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors",
                  n.readAt
                    ? "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30"
                    : "border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20"
                )}
              >
                <span className="font-medium text-slate-900 dark:text-white">{n.title}</span>
                <p className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">{n.body}</p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Мои мечты
        </h2>
        {myDreams.length === 0 ? (
          <p className="text-slate-500 text-sm mb-2">Пока нет. <Link href="/dreams/new" className="text-indigo-600">Создать</Link></p>
        ) : (
          <ul className="space-y-2">
            {myDreams.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/dreams/${d.id}`}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                >
                  <DarumaIcon status={d.status} className="!h-10 !w-10" />
                  <div>
                    <p className="text-slate-900 dark:text-white text-sm font-medium">{d.shortTitle}</p>
                    <p className="text-xs text-slate-500">{DREAM_STATUS_LABEL[d.status] ?? d.status}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/dreams" className="inline-block mt-3 text-sm text-indigo-600">
          Все мечты (включая чужие, где вы в поддержке) →
        </Link>
      </section>
    </div>
  );
}
