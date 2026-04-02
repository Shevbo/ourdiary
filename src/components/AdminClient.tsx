"use client";

import { useState } from "react";
import { Shield, Plus, X, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  avatarUrl: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "Суперадмин",
  ADMIN: "Администратор",
  MEMBER: "Участник",
};

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-400",
  ADMIN: "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-400",
  MEMBER: "bg-slate-200 dark:bg-slate-500/20 text-slate-700 dark:text-slate-400",
};

export default function AdminClient({
  users: initialUsers,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [showForm, setShowForm] = useState(false);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const router = useRouter();

  // Create user form
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleRoleChange(userId: string, newRole: string) {
    if (userId === currentUserId) return;
    setChangingRole(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
      }
    } finally {
      setChangingRole(null);
    }
  }

  async function handleCreate(ev: React.FormEvent) {
    ev.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка");
        return;
      }
      setSuccess(`Пользователь ${email} создан`);
      setEmail(""); setName(""); setPassword(""); setRole("MEMBER");
      router.refresh();
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-indigo-400" />
        <h1 className="text-slate-900 dark:text-white text-2xl font-bold">Администрирование</h1>
        <button
          onClick={() => setShowForm(true)}
          className="ml-auto flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Создать пользователя
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-transparent">
              <th className="text-left text-slate-600 dark:text-slate-400 text-xs font-medium px-4 py-3">Пользователь</th>
              <th className="text-left text-slate-600 dark:text-slate-400 text-xs font-medium px-4 py-3">Email</th>
              <th className="text-left text-slate-600 dark:text-slate-400 text-xs font-medium px-4 py-3">Роль</th>
              <th className="text-left text-slate-600 dark:text-slate-400 text-xs font-medium px-4 py-3">Зарегистрирован</th>
              <th className="text-left text-slate-600 dark:text-slate-400 text-xs font-medium px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-200 dark:border-slate-800 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {u.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatarUrl} alt={u.name ?? ""} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <span className="text-slate-900 dark:text-white text-sm">{u.name ?? "—"}</span>
                    {u.id === currentUserId && (
                      <span className="text-xs text-indigo-600 dark:text-indigo-400">(вы)</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300 text-sm">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", ROLE_COLORS[u.role])}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {format(new Date(u.createdAt), "d MMM yyyy", { locale: ru })}
                </td>
                <td className="px-4 py-3">
                  {u.id !== currentUserId && u.role !== "SUPERADMIN" && (
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={changingRole === u.id}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 min-h-9"
                    >
                      <option value="MEMBER">Участник</option>
                      <option value="ADMIN">Администратор</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create user modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-slate-900 dark:text-white font-semibold text-lg">Новый пользователь</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white min-h-11 min-w-11 flex items-center justify-center sm:min-h-0 sm:min-w-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Имя</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Пароль *</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Роль</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="MEMBER">Участник</option>
                  <option value="ADMIN">Администратор</option>
                </select>
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-600 dark:text-red-400 text-sm">{error}</div>
              )}
              {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 text-emerald-700 dark:text-emerald-400 text-sm">{success}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 font-medium rounded-lg px-4 py-2.5 transition-colors text-sm min-h-11 sm:min-h-0"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={cn("flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-4 py-2.5 transition-colors text-sm", loading && "opacity-60 cursor-not-allowed")}
                >
                  {loading ? "Создание…" : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
