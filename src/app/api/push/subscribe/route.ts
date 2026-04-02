import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isWebPushConfigured } from "@/lib/push-notify";

type Body = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(req: NextRequest) {
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "Push не настроен" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const body = (await req.json()) as Body;
  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Некорректная подписка" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: session.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    update: {
      userId: session.user.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint обязателен" }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({
    where: { userId: session.user.id, endpoint },
  });

  return NextResponse.json({ ok: true });
}
