import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAlice } from "@/lib/alice-auth";

export async function GET(req: NextRequest) {
  const denied = requireAlice(req);
  if (denied) return denied;

  const state = await prisma.tvViewState.findUnique({ where: { id: "tv" } });
  if (!state) {
    return NextResponse.json({ view: "month", anchor: new Date().toISOString(), events: [] });
  }

  return NextResponse.json({
    view: state.view,
    anchor: state.anchor.toISOString(),
    events: state.snapshot,
  });
}
