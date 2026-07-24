import { proxyJson } from "../../../_lib/proxy";

// D-33 — undo window (<=10s since creation) hard-deletes the venta via
// DELETE /ventas/{id} on the backend. Kept separate from the sibling
// api/ventas/[id]/route.ts DELETE, which proxies the unrelated general
// "Eliminar" action on /tours_servicios/{id} (D-14 lock semantics).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyJson(`/ventas/${id}`, "DELETE");
}
