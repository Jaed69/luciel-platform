import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_URL = process.env.TOURS_API_URL || "http://tours-api:8000";

async function proxyGet(path: string) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.token?.token;
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  const text = await res.text();
  return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
}

export async function GET(_req: Request, { params }: { params: Promise<{ entidad: string }> }) {
  const { entidad } = await params;
  return proxyGet(`/${entidad}`);
}