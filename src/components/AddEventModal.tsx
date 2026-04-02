"use client";

import { useState } from "react";
import { X, Plus, Trash2, ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Link = { label: string; url: string };

const EVENT_TYPES = [
  { value: "DIARY", label: "Запись в дневнике" },
  { value: "PLAN", label: "Запланированное мероприятие" },
  { value: "BIRTHDAY", label: "День рождения" },
  { value: "HOLIDAY", label: "Праздник / отпуск" },
  { value: "REMINDER", label: "Напоминание" },
];

export default function AddEventModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("DIARY");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addLink() {
    setLinks((l) => [...l, { label: "", url: "" }]);
  }
  function removeLink(i: number) {
    setLinks((l) => l.filter((_, idx) => idx !== i));
  }
  function updateLink(i: number, field: "label" | "url", value: string) {
    setLinks((l) => l.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));
  }

  async function handleImageFile(file: File | null) {
    if (!file) return;
    setError("");
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/event-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Не удалось загрузить изображение");
        return;
      }
      if (data.url) setImageUrl(data.url);
    } catch {
      setError("Ошибка загрузки файла");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          type,
          date,
          endDate: endDate || undefined,
          imageUrl: imageUrl || undefined,
          links: links.filter((l) => l.label && l.url),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Ошибка при создании события");
        return;
      }
      onCreated();
      onClose();
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-slate-900 dark:text-white font-semibold text-lg">Новое событие</h2>
          <button type="button" onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors min-h-11 min-w-11 flex items-center justify-center sm:min-h-0 sm:min-w-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Заголовок *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Название события"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Тип</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Дата *</label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Дата окончания</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Подробности события…"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Изображение</label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center justify-center gap-2 w-full border border-dashed border-slate-400 dark:border-slate-600 rounded-lg px-3 py-4 text-slate-500 dark:text-slate-400 text-sm cursor-pointer hover:border-indigo-500/60 dark:hover:border-indigo-500/50 hover:text-slate-700 dark:hover:text-slate-300 transition-colors min-h-11">
                {uploadingImage ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ImagePlus className="w-5 h-5" />
                )}
                <span>{uploadingImage ? "Загрузка…" : "Загрузить файл (до 5 МБ)"}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={uploadingImage}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    void handleImageFile(f ?? null);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="text-slate-500 dark:text-slate-500 text-xs">или укажите ссылку:</p>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-slate-700 dark:text-slate-300 text-sm font-medium">Ссылки</label>
              <button
                type="button"
                onClick={addLink}
                className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" /> Добавить
              </button>
            </div>
            <div className="space-y-2">
              {links.map((link, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={link.label}
                    onChange={(e) => updateLink(i, "label", e.target.value)}
                    placeholder="Название"
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    value={link.url}
                    onChange={(e) => updateLink(i, "url", e.target.value)}
                    placeholder="https://…"
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeLink(i)}
                    className="text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 font-medium rounded-lg px-4 py-2.5 transition-colors text-sm min-h-11 sm:min-h-0"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-4 py-2.5 transition-colors text-sm",
                loading && "opacity-60 cursor-not-allowed"
              )}
            >
              {loading ? "Сохранение…" : "Создать событие"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
