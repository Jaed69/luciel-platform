import { proxyJson } from "../../../_lib/proxy";

export async function PUT(req: Request, { params }: { params: Promise<{ entidad: string; row_id: string }> }) {
  const { entidad, row_id } = await params;
  return proxyJson(`/${entidad}/${row_id}`, "PUT", await req.text());
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ entidad: string; row_id: string }> }) {
  const { entidad, row_id } = await params;
  return proxyJson(`/${entidad}/${row_id}`, "DELETE");
}

// D-03 corollary — dedicated restore endpoint. POST with no body; backend flips activo=true.
export async function POST(_req: Request, { params }: { params: Promise<{ entidad: string; row_id: string }> }) {
  const { entidad, row_id } = await params;
  return proxyJson(`/${entidad}/${row_id}/restore`, "POST");
}