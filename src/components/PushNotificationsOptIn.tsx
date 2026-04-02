"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function PushNotificationsOptIn() {
  const { data: session, status } = useSession();
  const [visible, setVisible] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status !== "authenticated" || !session) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    let cancelled = false;
    (async () => {
      const res = await fetch("/api/push/vapid-public");
      if (!res.ok || cancelled) return;
      setVisible(true);
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          setSubscribed(!!sub);
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session]);

  const enable = useCallback(async () => {
    setMessage("");
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMessage("Разрешите уведомления в настройках браузера");
        setBusy(false);
        return;
      }

      const keyRes = await fetch("/api/push/vapid-public");
      if (!keyRes.ok) {
        setMessage("Сервер не настроил push (VAPID)");
        setBusy(false);
        return;
      }
      const { publicKey } = (await keyRes.json()) as { publicKey: string };

      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await reg.update();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setMessage("Не удалось создать подписку");
        setBusy(false);
        return;
      }

      const save = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        }),
      });

      if (!save.ok) {
        const d = await save.json().catch(() => ({}));
        setMessage((d as { error?: string }).error ?? "Ошибка сохранения подписки");
        setBusy(false);
        return;
      }

      setSubscribed(true);
    } catch {
      setMessage("Ошибка включения уведомлений");
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, { method: "DELETE" });
      }
      setSubscribed(false);
    } catch {
      setMessage("Не удалось отключить");
    } finally {
      setBusy(false);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "mx-4 mb-4 md:mx-6 rounded-xl border px-4 py-3 flex flex-wrap items-center gap-3",
        "bg-indigo-500/10 border-indigo-500/25 text-slate-800 dark:text-slate-200"
      )}
    >
      <Bell className="w-5 h-5 text-indigo-500 flex-shrink-0" />
      <div className="flex-1 min-w-[200px] text-sm">
        <p className="font-medium">Уведомления на телефон</p>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
          О новых событиях в семейной ленте (Web Push)
        </p>
        {message && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{message}</p>}
      </div>
      {subscribed ? (
        <button
          type="button"
          disabled={busy}
          onClick={disable}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          <BellOff className="w-4 h-4" />
          Отключить
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={enable}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
        >
          <Bell className="w-4 h-4" />
          {busy ? "…" : "Включить"}
        </button>
      )}
    </div>
  );
}
