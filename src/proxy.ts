import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const authProxy = withAuth(
  function proxy() {
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
