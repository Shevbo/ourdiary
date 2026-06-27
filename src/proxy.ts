import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const authProxy = withAuth(
  function proxy(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    if (token?.isServiceUser === true) {
      if (path.startsWith("/api/")) {
        return NextResponse.json({ error: "Режим дисплея: доступен только экран TV" }, { status: 403 });
      }
      // Дисплей-сессия (ТВ-киоск) видит весь раздел /tv/* — дашборд и календарь
      if (path !== "/tv" && !path.startsWith("/tv/")) {
        return NextResponse.redirect(new URL("/tv", req.nextUrl.origin));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export default authProxy;

export const config = {
  matcher: [
    "/((?!login|security|api/auth|api/alice|api/tv|tv/local|tv/launcher|_next/static|_next/image|favicon.ico|uploads).*)",
  ],
};
