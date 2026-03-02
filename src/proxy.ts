import withAuth from "next-auth/middleware";

export default withAuth;

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/instances/:path*",
    "/settings/:path*",
    "/admin/:path*",
  ],
};
