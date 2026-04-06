"use client";

import { usePathname } from "next/navigation";
import Navigation from "./Navigation";
import PushNotificationsOptIn from "./PushNotificationsOptIn";
import MobileHeader from "./MobileHeader";

const NO_NAV_PATHS = ["/login", "/security"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = !NO_NAV_PATHS.includes(pathname);
  const isTv = pathname === "/tv";

  if (!showNav) {
    return <>{children}</>;
  }

  if (isTv) {
    return <div className="min-h-[100dvh] min-w-0 bg-slate-950">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navigation />
      <main className="flex-1 md:ml-56 pb-16 md:pb-0 flex flex-col min-w-0">
        <MobileHeader />
        <PushNotificationsOptIn />
        <div className="flex-1 flex flex-col min-w-0">{children}</div>
      </main>
    </div>
  );
}
