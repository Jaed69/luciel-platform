import { withAuth } from "next-auth/middleware";

// RBAC route guard (UI-SPEC §Nav):
// - vendedor → redirect / to /ventas; block /catalogos and /admin
// - contabilidad → block /catalogos and /admin
// - admin → all routes
export default withAuth({
  pages: { signIn: "/login" },
  callbacks: {
    authorized: ({ token, req }) => {
      const role = token?.role as string | undefined;
      const path = req.nextUrl.pathname;
      if (!role) return false; // not logged in → redirect to /login
      if (path === "/" && role === "vendedor") {
        // vendedor redirect to /ventas handled in layout/page
        return true; // allow pass-through; page itself redirects
      }
      if (path.startsWith("/catalogos") || path.startsWith("/admin")) {
        return role === "admin";
      }
      return true;
    },
  },
});

export const config = {
  matcher: ["/", "/ventas", "/liquidaciones", "/catalogos/:path*", "/admin/:path*"],
};