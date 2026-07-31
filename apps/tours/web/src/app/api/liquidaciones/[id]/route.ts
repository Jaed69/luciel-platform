import { proxyJson } from "../../_lib/proxy";

// DELETE — anula una liquidación `abierta` (libera sus tours y borra la fila).
// El backend responde 409 si ya está cerrada: ese camino es /reopen.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyJson(`/liquidaciones/${id}`, "DELETE");
}
