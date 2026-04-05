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
      if (path !== "/tv") {
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
    "/((?!login|security|api/auth|_next/static|_next/image|favicon.ico|uploads).*)",
  ],
};
