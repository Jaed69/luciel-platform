import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_URL = process.env.TOURS_API_URL || "http://tours-api:8000";

// D-33 — forwards query params (q, vendedor_id) rather than a body, same
// pattern as /api/simular (see inline note there).
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.token?.token;
  const url = new URL(req.url);
  const res = await fetch(`${API_URL}/ventas/tour-search?${url.searchParams}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  const text = await res.text();
  return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
}
