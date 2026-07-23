import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { apiFetchJson } from "@/lib/api";
import { AgenciaDetailClient } from "./AgenciaDetailClient";

type Agencia = { id: number; codigo?: string; nombre: string; activo: boolean };
type Tour = { id: number; nombre: string };
type AgenciaPrecio = { id: number; agencia_id: number; tour_id: number; precio: number; precio_usd: number | null; activo: boolean };
type AgenciaPago = { id: number; agencia_id: number; fecha: string; monto: number; moneda: string; metodo: string; referencia: string | null; nota: string | null };
type Saldo = { agencia_id: number; PEN: number; USD: number };

export default async function AgenciaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = (session.user as any)?.role;
  if (!["admin", "contabilidad"].includes(role)) redirect("/ventas");

  const { id } = await params;
  const agenciaId = Number(id);

  const [agencias, tours, precios, pagos, saldo] = await Promise.all([
    apiFetchJson<Agencia[]>("/agencias").catch(() => []),
    apiFetchJson<Tour[]>("/tours").catch(() => []),
    apiFetchJson<AgenciaPrecio[]>("/agencia-precios").catch(() => []),
    apiFetchJson<AgenciaPago[]>(`/agencia-pagos?agencia_id=${agenciaId}`).catch(() => []),
    apiFetchJson<Saldo>(`/agencias/${agenciaId}/saldo`).catch(() => ({ agencia_id: agenciaId, PEN: 0, USD: 0 })),
  ]);

  const agencia = agencias.find((a) => a.id === agenciaId);
  if (!agencia) redirect("/agencias");

  const preciosAgencia = precios.filter((p) => p.agencia_id === agenciaId);

  return <AgenciaDetailClient agencia={agencia} tours={tours} precios={preciosAgencia} pagos={pagos} saldo={saldo} />;
}
