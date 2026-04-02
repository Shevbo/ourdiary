"use client";

import { usePathname } from "next/navigation";
import Navigation from "./Navigation";
import PushNotificationsOptIn from "./PushNotificationsOptIn";

const NO_NAV_PATHS = ["/login", "/tv", "/security"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = !NO_NAV_PATHS.includes(pathname);

  if (!showNav) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navigation />
      <main className="flex-1 md:ml-56 pb-16 md:pb-0 flex flex-col min-w-0">
        <PushNotificationsOptIn />
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
