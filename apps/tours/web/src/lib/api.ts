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

export function formatCurrency(monto: number, moneda: "PEN" | "USD"): string {
  const currency = moneda === "PEN" ? "PEN" : "USD";
  return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(monto);
}