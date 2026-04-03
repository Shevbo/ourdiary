import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { mapPortalRoleToOurdiary } from "./map-portal-role";
import { verifyShectoryPortalCredentials } from "./shectory-portal-auth";

function useShectoryPortalCatalog(): boolean {
  return Boolean(process.env.SHECTORY_AUTH_BRIDGE_SECRET?.trim());
}

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
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.trim().toLowerCase();
        const password = credentials.password;

        if (useShectoryPortalCatalog()) {
          const portal = await verifyShectoryPortalCredentials(email, password);
          if (!portal) return null;

          const role = mapPortalRoleToOurdiary(portal.role);
          const nameFromPortal = portal.fullName.trim() || null;
          const u = await prisma.user.upsert({
            where: { email: portal.email },
            create: {
              email: portal.email,
              name: nameFromPortal,
              passwordHash: null,
              role,
            },
            update: {
              role,
              ...(nameFromPortal ? { name: nameFromPortal } : {}),
            },
          });

          return {
            id: u.id,
            email: u.email,
            name: u.name,
            image: u.avatarUrl,
            role: u.role,
          };
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "MEMBER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};
