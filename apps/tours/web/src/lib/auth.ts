import { createHmac } from "node:crypto";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// NextAuth Credentials provider — bridges to FastAPI /auth/login (D-02).
// NextAuth stores session as a JWE-encrypted cookie with the decoded payload
// inside. The FastAPI backend expects a *signed* HS256 JWT (verifiable with
// `jwt.decode(token, NEXTAUTH_SECRET, [HS256])`), not a JWE cookie nor a
// decoded object. So the jwt callback signs a compact HS256 JWT via node
// crypto (no new dependency) and embeds it as `token.token` — exposed to
// server-side route handlers via the session callback.
function signHs256Jwt(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url").replace(/=+$/, "");
  const data = `${enc(header)}.${enc(payload)}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url").replace(/=+$/, "");
  return `${data}.${sig}`;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Correo o usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials) return null;
        try {
          const res = await fetch(`${process.env.TOURS_API_URL || "http://tours-api:8000"}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: credentials.identifier, password: credentials.password }),
          });
          if (!res.ok) return null;
          const user = await res.json();
          return { id: String(user.id), email: user.email, name: user.username, role: user.role } as any;
        } catch {
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const id = String((user as any).id);
        const role = (user as any).role as string;
        const email = (user as any).email as string;
        const name = (user as any).name as string | undefined;
        token.role = role;
        token.id = id;
        // Sign the HS256 JWT the FastAPI backend will verify via pyjwt.
        token.token = signHs256Jwt(
          { sub: id, role, email, ...(name ? { name } : {}) },
          process.env.NEXTAUTH_SECRET as string,
        );
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session as any).token = token;
      }
      return session;
    },
  },
};