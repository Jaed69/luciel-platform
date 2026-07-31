import { proxyJson } from "../_lib/proxy";

// D-34 — alta de traslado. Circuito propio en el backend (POST /traslados)
// porque suma el hotel y deriva su comisión; la edición y el borrado siguen
// yendo por /api/ventas/[id], que opera sobre tours_servicios sin distinguir tipo.
export async function POST(req: Request) {
  return proxyJson("/traslados", "POST", await req.text());
}
