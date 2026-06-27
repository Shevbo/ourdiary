import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAlice } from "@/lib/alice-auth";
import { getOrCreateUploadToken } from "@/lib/upload-token-db";
import { uploadUrlForToken } from "@/lib/upload-token";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAlice(req);
  if (denied) return denied;

  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { token, expiresAt } = await getOrCreateUploadToken(id);
  return NextResponse.json({
    token,
    url: uploadUrlForToken(token),
    expiresAt: expiresAt.toISOString(),
  });
}
