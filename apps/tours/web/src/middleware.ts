import { withAuth } from "next-auth/middleware";

// RBAC route guard (UI-SPEC §Nav, updated D-13 phase 02.1.1):
// - vendedor → /ventas redirect handled in layout; /catalogos blocked; /admin blocked
// - contabilidad → /catalogos allowed (D-13); /admin blocked
// - admin → all routes
// - /perfil → any authenticated user (D-08)
export default withAuth({
  pages: { signIn: "/login" },
  callbacks: {
    authorized: ({ token, req }) => {
      const role = token?.role as string | undefined;
      const path = req.nextUrl.pathname;
      if (!role) return false;
      if (path === "/" && role === "vendedor") return true; // pass-through; page redirects
      if (path.startsWith("/admin")) {
        return role === "admin";
      }
      if (path.startsWith("/catalogos")) {
        // D-13 — admin + contabilidad.
        return role === "admin" || role === "contabilidad";
      }
      return true; // /perfil and other routes: any authed user.
    },
  },
});

export const config = {
  matcher: ["/", "/ventas", "/liquidaciones", "/catalogos/:path*", "/admin/:path*", "/perfil"],
};