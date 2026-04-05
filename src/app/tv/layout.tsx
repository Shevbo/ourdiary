import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#020617",
};

export default function TvLayout({ children }: { children: React.ReactNode }) {
  return <div className="tv-root min-h-[100dvh] min-w-0 bg-slate-950">{children}</div>;
}
