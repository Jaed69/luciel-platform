import { proxyJson } from "../_lib/proxy";

export async function GET(_req: Request, { params }: { params: Promise<{ entidad: string }> }) {
  const { entidad } = await params;
  return proxyJson(`/${entidad}`, "GET");
}