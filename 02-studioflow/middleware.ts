export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/admin/dashboard/:path*",
    "/admin/contacts/:path*",
    "/admin/photographs/:path*",
    "/admin/testimonials/:path*"
  ],
};
