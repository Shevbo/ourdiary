import type { UserRole } from "@prisma/client";

/** Роли каталога портала (portal_users.role) → роли дневника. */
export function mapPortalRoleToOurdiary(portalRole: string): UserRole {
  const r = portalRole.trim().toLowerCase();
  if (r === "superadmin") return "SUPERADMIN";
  if (r === "admin") return "ADMIN";
  return "MEMBER";
}
