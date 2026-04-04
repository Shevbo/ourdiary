import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/create-notification";

function isSuper(role: string) {
  return role === "SUPERADMIN";
}

function visibleWhere(userId: string, role: string) {
  if (isSuper(role)) return {};
  return {
    OR: [{ authorId: userId }, { supports: { some: { supporterId: userId } } }],
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const dreams = await prisma.dream.findMany({
    where: visibleWhere(session.user.id, session.user.role),
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      supports: {
        include: { supporter: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
    orderBy: [{ orderNo: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(dreams);
}

type SupportIn = { supporterId: string; requestedSembons: number };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const body = await req.json();
  const shortTitle = String(body.shortTitle ?? "").trim();
  const bodyRich = String(body.bodyRich ?? "");
  const status = body.status === "ACTIVE" ? "ACTIVE" : "DRAFTING";
  const supportsIn = (Array.isArray(body.supports) ? body.supports : []) as SupportIn[];

  if (!shortTitle) return NextResponse.json({ error: "shortTitle обязателен" }, { status: 400 });

  for (const s of supportsIn) {
    if (s.supporterId === session.user.id) {
      return NextResponse.json({ error: "Нельзя назначить поддержку от себя" }, { status: 400 });
    }
    if (!s.supporterId || s.requestedSembons < 1) {
      return NextResponse.json({ error: "Некорректные строки поддержки" }, { status: 400 });
    }
  }

  const maxRow = await prisma.dream.aggregate({ _max: { orderNo: true } });
  const orderNo = (maxRow._max.orderNo ?? 0) + 1;

  const dream = await prisma.dream.create({
    data: {
      orderNo,
      shortTitle,
      bodyRich,
      status,
      authorId: session.user.id,
      supports: {
        create: supportsIn.map((s) => ({
          supporterId: s.supporterId,
          requestedSembons: s.requestedSembons,
        })),
      },
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      supports: {
        include: { supporter: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });

  if (status === "ACTIVE" && dream.supports.length > 0) {
    const authorName = dream.author.name ?? dream.author.id;
    for (const row of dream.supports) {
      await createNotification({
        userId: row.supporterId,
        title: "Нужно согласование мечты",
        body: `${authorName}: «${shortTitle}». Откройте карточку и согласуйте сембоны.`,
        linkUrl: `/dreams/${dream.id}`,
      });
    }
  }

  return NextResponse.json(dream, { status: 201 });
}
