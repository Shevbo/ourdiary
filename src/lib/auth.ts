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
          const portalEmail =
            user?.email ?? (raw.includes("@") ? raw.trim().toLowerCase() : null);

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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "MEMBER";
        token.isServiceUser = Boolean((user as { isServiceUser?: boolean }).isServiceUser);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.isServiceUser = Boolean(token.isServiceUser);
      }
      return session;
    },
  },
};
