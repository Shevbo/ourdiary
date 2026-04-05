"use client";

import { useState } from "react";
import { Shield, Plus, X, Trash2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import AvatarImg from "./AvatarImg";
import AdminAppNewsSection from "./AdminAppNewsSection";
import AdminExpenseCategoriesSection from "./AdminExpenseCategoriesSection";

type UserRow = {
  id: string;
  loginName: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  avatarUrl: string | null;
  isServiceUser: boolean;
  sembonManualAdjust: number;
  monthlyBudgetByCategory: unknown;
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
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const router = useRouter();

  const [loginName, setLoginName] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [isServiceUser, setIsServiceUser] = useState(false);
  const [sembonManualAdjust, setSembonManualAdjust] = useState("0");
  const [monthlyBudgetJson, setMonthlyBudgetJson] = useState("");
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
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      }
    } finally {
      setChangingRole(null);
    }
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setLoginName(u.loginName);
    setEmail(u.email);
    setName(u.name ?? "");
    setPassword("");
    setRole(u.role);
    setIsServiceUser(u.isServiceUser);
    setSembonManualAdjust(String(u.sembonManualAdjust));
    setMonthlyBudgetJson(
      u.monthlyBudgetByCategory != null ? JSON.stringify(u.monthlyBudgetByCategory, null, 2) : ""
    );
    setError("");
    setSuccess("");
  }

  async function handleSaveEdit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!editing) return;
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginName,
          email,
          name: name || null,
          password: password || undefined,
          isServiceUser,
          sembonManualAdjust: parseInt(sembonManualAdjust, 10) || 0,
          monthlyBudgetByCategory: monthlyBudgetJson.trim() ? monthlyBudgetJson : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data.error as string) ?? "Ошибка");
        return;
      }
      setSuccess("Сохранено");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editing.id
            ? {
                ...u,
                loginName: data.loginName,
                email: data.email,
                name: data.name,
                isServiceUser: data.isServiceUser,
                sembonManualAdjust: data.sembonManualAdjust,
                monthlyBudgetByCategory: data.monthlyBudgetByCategory,
              }
            : u
        )
      );
      setEditing(null);
      router.refresh();
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm("Удалить пользователя?")) return;
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      router.refresh();
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
        body: JSON.stringify({ loginName, email, name, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка");
        return;
      }
      setSuccess(`Пользователь ${loginName} создан`);
      setLoginName(""); setEmail(""); setName(""); setPassword(""); setRole("MEMBER");
      router.refresh();
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-indigo-400" />
        <h1 className="text-slate-900 dark:text-white text-2xl font-bold">Администрирование</h1>
        <button
          onClick={() => {
            setShowForm(true);
            setLoginName("");
            setEmail("");
            setName("");
            setPassword("");
            setRole("MEMBER");
            setError("");
            setSuccess("");
          }}
          className="ml-auto flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Создать пользователя
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-transparent">
              <th className="text-left text-slate-600 dark:text-slate-400 text-xs font-medium px-4 py-3">Имя входа</th>
              <th className="text-left text-slate-600 dark:text-slate-400 text-xs font-medium px-4 py-3">Email</th>
              <th className="text-left text-slate-600 dark:text-slate-400 text-xs font-medium px-4 py-3">Роль</th>
              <th className="text-left text-slate-600 dark:text-slate-400 text-xs font-medium px-4 py-3">Сембоны ±</th>
              <th className="text-left text-slate-600 dark:text-slate-400 text-xs font-medium px-4 py-3">Служебн.</th>
              <th className="text-left text-slate-600 dark:text-slate-400 text-xs font-medium px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-200 dark:border-slate-800 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AvatarImg src={u.avatarUrl} alt={u.name ?? ""} name={u.name ?? u.loginName} size="xs" />
                    <div>
                      <span className="text-slate-900 dark:text-white text-sm font-medium">{u.loginName}</span>
                      {u.id === currentUserId && (
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 ml-1">(вы)</span>
                      )}
                      <p className="text-slate-500 text-xs">{u.name ?? "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300 text-sm">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", ROLE_COLORS[u.role])}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                  {u.id !== currentUserId && u.role !== "SUPERADMIN" && (
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={changingRole === u.id}
                      className="mt-1 block w-full max-w-[140px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-900 dark:text-white text-xs"
                    >
                      <option value="MEMBER">Участник</option>
                      <option value="ADMIN">Администратор</option>
                    </select>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 text-sm">{u.sembonManualAdjust}</td>
                <td className="px-4 py-3 text-sm">{u.isServiceUser ? "да" : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="p-1.5 rounded text-slate-500 hover:text-indigo-500"
                      title="Редактировать"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {u.id !== currentUserId && u.role !== "SUPERADMIN" && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(u.id)}
                        className="p-1.5 rounded text-slate-500 hover:text-red-500"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminAppNewsSection />
      <AdminExpenseCategoriesSection />

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
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Имя для входа *</label>
                <input
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
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

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-slate-900 dark:text-white font-semibold text-lg">Пользователь</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white min-h-11 min-w-11 flex items-center justify-center sm:min-h-0 sm:min-w-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Имя для входа</label>
                <input
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Имя</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Новый пароль</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Оставьте пустым, чтобы не менять"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={isServiceUser}
                  onChange={(e) => setIsServiceUser(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Служебный пользователь (TV и т.п.)
              </label>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Корректировка сембонов</label>
                <input
                  type="number"
                  value={sembonManualAdjust}
                  onChange={(e) => setSembonManualAdjust(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">Бюджет по категориям (JSON)</label>
                <textarea
                  value={monthlyBudgetJson}
                  onChange={(e) => setMonthlyBudgetJson(e.target.value)}
                  rows={4}
                  placeholder='{"FOOD": 50000, "TRANSPORT": 10000}'
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
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
                  onClick={() => setEditing(null)}
                  className="flex-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 font-medium rounded-lg px-4 py-2.5 transition-colors text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={cn("flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-4 py-2.5 transition-colors text-sm", loading && "opacity-60 cursor-not-allowed")}
                >
                  {loading ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
