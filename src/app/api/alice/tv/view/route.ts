import { NextRequest, NextResponse } from "next/server";
import { requireAlice } from "@/lib/alice-auth";
import { getNumberedEvents, normalizeView } from "@/lib/tv-calendar";

export async function GET(req: NextRequest) {
  const denied = requireAlice(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const view = normalizeView(searchParams.get("view"));
  const anchorRaw = searchParams.get("anchor");
  const anchorDate = anchorRaw ? new Date(anchorRaw) : new Date();
  const anchor = Number.isNaN(anchorDate.getTime()) ? new Date() : anchorDate;

  const result = await getNumberedEvents(view, anchor);
  return NextResponse.json(result);
}
