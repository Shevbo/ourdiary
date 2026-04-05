"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

const DEFAULT_ORDER = ["/", "/calendar", "/expenses", "/tasks", "/dreams", "/rating", "/tv"];

const STORAGE_KEY = "ourdiary-nav-order";

function mergeOrder(saved: string[] | null): string[] {
  if (!saved?.length) return [...DEFAULT_ORDER];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of saved) {
    if (DEFAULT_ORDER.includes(h) && !seen.has(h)) {
      out.push(h);
      seen.add(h);
    }
  }
  for (const h of DEFAULT_ORDER) {
    if (!seen.has(h)) out.push(h);
  }
  return out;
}

export default function SwipeableMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const x0 = useRef(0);
  const y0 = useRef(0);

  const getOrder = useCallback(() => {
    if (typeof window === "undefined") return DEFAULT_ORDER;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : null;
      return mergeOrder(parsed);
    } catch {
      return [...DEFAULT_ORDER];
    }
  }, []);

  function onTouchStart(e: React.TouchEvent) {
    x0.current = e.touches[0].clientX;
    y0.current = e.touches[0].clientY;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - x0.current;
    const dy = e.changedTouches[0].clientY - y0.current;
    if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy)) return;

    const order = getOrder();
    const idx = order.indexOf(pathname);
    if (idx === -1) return;

    if (dx < 0 && idx < order.length - 1) {
      router.push(order[idx + 1]!);
    } else if (dx > 0 && idx > 0) {
      router.push(order[idx - 1]!);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 touch-pan-y" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {children}
    </div>
  );
}
