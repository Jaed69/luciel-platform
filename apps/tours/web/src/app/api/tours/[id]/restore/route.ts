import { proxyJson } from "../../../_lib/proxy";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyJson(`/tours/${id}/restore`, "POST");
}
