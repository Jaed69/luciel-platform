import { proxyJson } from "../../_lib/proxy";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyJson(`/agencia-precios/${id}`, "PUT", await req.text());
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyJson(`/agencia-precios/${id}`, "DELETE");
}
