import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_URL = process.env.TOURS_API_URL || "http://tours-api:8000";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.token?.token;
  const url = new URL(req.url);
  const res = await fetch(`${API_URL}/simular?${url.searchParams}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  const text = await res.text();
  return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
}