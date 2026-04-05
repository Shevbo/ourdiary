import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { mapPortalRoleToOurdiary } from "./map-portal-role";
import { verifyShectoryPortalCredentials } from "./shectory-portal-auth";
import { findUserByEmailInsensitive } from "./user-by-email";
import { findUserByLoginNameInsensitive, uniqueLoginNameFromEmailLocalPart } from "./user-lookup";

function useShectoryPortalCatalog(): boolean {
  return Boolean(process.env.SHECTORY_AUTH_BRIDGE_SECRET?.trim());
}

function normalizeEmailInput(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * E-mail для POST /api/internal/verify-portal-credentials (каталог портала принимает только email).
 * Полный адрес в поле ввода; иначе — email из профиля в БД; иначе local@SHECTORY_LOGIN_EMAIL_DOMAIN (семейный домен).
 */
function resolvePortalLoginEmail(
  raw: string,
  user: { email: string } | null
): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.includes("@")) {
    return normalizeEmailInput(t);
  }
  if (user?.email?.trim()) {
    return normalizeEmailInput(user.email);
  }
  const domain = process.env.SHECTORY_LOGIN_EMAIL_DOMAIN?.trim();
  if (domain && /^[^\s@]+$/.test(t)) {
    const d = domain.replace(/^@/, "");
    return `${t.toLowerCase()}@${d.toLowerCase()}`;
  }
  return null;
}

function sessionUserFromDb(u: {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  isServiceUser: boolean;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.avatarUrl,
    role: u.role,
    isServiceUser: u.isServiceUser,
  };
}

/**
 * Вход по **имени для входа** (`loginName`). Каталог Shectory проверяется по email учётки в БД.
 * Если ввести полный email и записи ещё нет — первый успешный ответ портала создаёт пользователя (как раньше).
 */
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        loginName: { label: "Имя для входа", type: "text" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        const raw = credentials?.loginName?.trim() ?? "";
        const password = credentials?.password ?? "";
        if (!raw || !password) return null;

        let user = await findUserByLoginNameInsensitive(raw);
        if (!user && raw.includes("@")) {
          user = await findUserByEmailInsensitive(raw);
        }

        if (useShectoryPortalCatalog()) {
          const portalEmail = resolvePortalLoginEmail(raw, user);

          if (portalEmail) {
            const portal = await verifyShectoryPortalCredentials(portalEmail, password);
            if (portal) {
              const role = mapPortalRoleToOurdiary(portal.role);
              const nameFromPortal = portal.fullName.trim() || null;
              const emailLower = portal.email.trim().toLowerCase();
              const existing = await findUserByEmailInsensitive(portal.email);
              const u = existing
                ? await prisma.user.update({
                    where: { id: existing.id },
                    data: {
                      email: emailLower,
                      role,
                      ...(nameFromPortal ? { name: nameFromPortal } : {}),
                    },
                  })
                : await prisma.user.create({
                    data: {
                      loginName: await uniqueLoginNameFromEmailLocalPart(
                        emailLower.split("@")[0] ?? "user"
                      ),
                      email: emailLower,
                      name: nameFromPortal,
                      passwordHash: null,
                      role,
                    },
                  });
              return sessionUserFromDb(u);
            }
          }

          if (!user?.passwordHash) return null;
          const okPortalFallback = await bcrypt.compare(password, user.passwordHash);
          if (!okPortalFallback) return null;
          return sessionUserFromDb(user);
        }

        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return sessionUserFromDb(user);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as { id: string; role?: string; isServiceUser?: boolean; image?: string | null; name?: string | null };
        token.id = u.id;
        token.role = u.role ?? "MEMBER";
        token.isServiceUser = Boolean(u.isServiceUser);
        token.picture = u.image ?? null;
        if (u.name !== undefined) token.name = u.name;
      }
      if (trigger === "update" && session && typeof session === "object" && "image" in session) {
        token.picture = (session as { image?: string | null }).image ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.isServiceUser = Boolean(token.isServiceUser);
        session.user.image = (token.picture as string | null | undefined) ?? null;
        if (token.name) session.user.name = token.name as string;
      }
      return session;
    },
  },
};
