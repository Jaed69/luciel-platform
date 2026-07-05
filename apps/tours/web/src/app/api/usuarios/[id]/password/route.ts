import { proxyJson } from "../../../_lib/proxy";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyJson(`/usuarios/${id}/password`, "PUT", await req.text());
}