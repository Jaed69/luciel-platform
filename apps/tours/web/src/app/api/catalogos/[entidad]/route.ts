import { proxyJson } from "../../_lib/proxy";

export async function GET(_req: Request, { params }: { params: Promise<{ entidad: string }> }) {
  const { entidad } = await params;
  return proxyJson(`/${entidad}`, "GET");
}

// Backend exposes create under /catalogos/{entidad} (not /{entidad}). Map here.
export async function POST(req: Request, { params }: { params: Promise<{ entidad: string }> }) {
  const { entidad } = await params;
  return proxyJson(`/catalogos/${entidad}`, "POST", await req.text());
}