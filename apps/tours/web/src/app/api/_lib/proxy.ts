// apps/tours/web/src/app/api/_lib/proxy.ts
// Shared Route Handler proxy for FastAPI calls with bearer JWT forwarding (D-02).
// The 3 existing handlers (ventas POST, catalogos GET, simular GET) and all 5 new
// /usuarios + /catalogos/[row_id] handlers funnel through here so behaviour stays
// uniform. simular is the intentional odd-one-out — its searchParams forwarding
// doesn't fit the (path, method, body) shape — see inline note in its route.ts.
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_URL = process.env.TOURS_API_URL || "http://tours-api:8000";

export async function proxyJson(path: string, method: string, body?: string): Promise<Response> {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.token?.token;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
    cache: "no-store",
  });
  const text = await res.text();
  // Status + body pass through verbatim so FastAPI's `detail` stays a JSON object
  // (e.g. {mensaje, referencias} on 409) — the client reads `err.detail.mensaje`.
  return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
}