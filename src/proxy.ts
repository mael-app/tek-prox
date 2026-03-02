import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Global auth middleware — defence-in-depth layer on top of per-route
 * requireSession() checks.
 *
 * - API routes → 401 JSON when unauthenticated
 * - Page routes → redirect to /login when unauthenticated
 *
 * /api/auth/* is excluded from the matcher so that the NextAuth
 * callback flow is never interrupted.
 */
export default async function middleware(req: NextRequest) {
  const token = await getToken({ req });

  if (!token) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/instances/:path*",
    "/settings/:path*",
    "/admin/:path*",
    // All API routes except the NextAuth handler
    "/api/((?!auth/).*)",
  ],
};
