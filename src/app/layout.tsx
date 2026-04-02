import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import AppShell from "@/components/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Наш дневник",
  description: "Семейная социальная сеть — лента событий, календарь, расходы, рейтинг",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${geistSans.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
