import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SERVICE_LOGIN_NAME = "dom-borisa";

/**
 * Проверка Bearer-токена сервис-эндпоинтов «Алисы»/«Дом Бориса».
 * - env ALICE_SERVICE_SECRET не задан → 503 (auth не настроен)
 * - заголовок отсутствует/неверный → 401
 * - всё ок → null (можно продолжать обработку)
 */
export function requireAlice(req: NextRequest): NextResponse | null {
  const secret = process.env.ALICE_SERVICE_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "service auth not configured" }, { status: 503 });
  }

  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1]?.trim();
  if (!token || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

let cachedServiceUserId: string | null = null;

/**
 * Id сервис-пользователя (loginName "dom-borisa") с лёгким кэшем.
 * Бросает понятную ошибку, если пользователь не засидирован.
 */
export async function getServiceUserId(): Promise<string> {
  if (cachedServiceUserId) return cachedServiceUserId;
  const user = await prisma.user.findUnique({
    where: { loginName: SERVICE_LOGIN_NAME },
    select: { id: true },
  });
  if (!user) {
    throw new Error(
      `Сервис-пользователь "${SERVICE_LOGIN_NAME}" не найден. Запустите prisma db seed.`
    );
  }
  cachedServiceUserId = user.id;
  return user.id;
}
