import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_URL = process.env.TOURS_API_URL || "http://tours-api:8000";

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.token?.token;
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers as any) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });
}

export async function apiFetchJson<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

// Re-exported for server components that already import from here; the
// implementation lives in lib/format.ts so client components can pull it in
// without dragging NextAuth's server-side bits along.
export { formatCurrency } from "@/lib/format";