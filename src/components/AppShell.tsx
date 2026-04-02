"use client";

import { usePathname } from "next/navigation";
import Navigation from "./Navigation";

const NO_NAV_PATHS = ["/login", "/tv"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = !NO_NAV_PATHS.includes(pathname);

  if (!showNav) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Navigation />
      <main className="flex-1 md:ml-56 pb-16 md:pb-0">
        {children}
      </main>
    </div>
  );
}
