// apps/tours/web/src/app/(app)/liquidaciones/page.tsx
// S4 — Liquidaciones list: H1 + "Nueva liquidación" button + filtered table with status badges.
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiFetchJson } from "@/lib/api";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { NewLiquidacionButton } from "./NewLiquidacionButton";

type LiquidacionRow = {
  id: number;
  codigo: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  estado: "abierta" | "cerrada" | "revertida";
  vendedor_id: number | null;
  agencia_id: number | null;
  cerrada_en: string | null;
};

export default async function LiquidacionesPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string;
  const userId = (session?.user as any)?.id as number | undefined;

  const qs = new URLSearchParams();
  if (searchParams.estado) qs.set("estado", searchParams.estado);
  if (searchParams.fecha_desde) qs.set("fecha_desde", searchParams.fecha_desde);
  if (searchParams.fecha_hasta) qs.set("fecha_hasta", searchParams.fecha_hasta);
  if (searchParams.vendedor_id) qs.set("vendedor_id", searchParams.vendedor_id);

  let liquidaciones: LiquidacionRow[] = [];
  try {
    liquidaciones = await apiFetchJson<LiquidacionRow[]>(`/liquidaciones${qs.toString() ? `?${qs.toString()}` : ""}`);
  } catch {}

  const canManage = role === "admin" || role === "contabilidad";

  const columns: Column<LiquidacionRow>[] = [
    { key: "codigo", header: "Código", render: (r) => (r.codigo ?? <span className="text-text-espresso-soft">—</span>) },
    {
      key: "estado",
      header: "Estado",
      render: (r) => <StatusBadge variant={r.estado}>{r.estado}</StatusBadge>,
    },
    {
      key: "rango",
      header: "Rango",
      render: (r) => (
        <span className="tabular-nums text-[13px]">
          {new Date(r.fecha_desde).toLocaleDateString("es-PE")} → {new Date(r.fecha_hasta).toLocaleDateString("es-PE")}
        </span>
      ),
    },
    {
      key: "vendedor_id",
      header: "Vendedor",
      render: (r) => (r.vendedor_id != null ? `V-${r.vendedor_id}` : <span className="text-text-espresso-soft">Todos</span>),
    },
    {
      key: "agencia_id",
      header: "Agencia",
      render: (r) => (r.agencia_id != null ? `AG-${r.agencia_id}` : <span className="text-text-espresso-soft">Todas</span>),
    },
    {
      key: "cerrada_en",
      header: "Cerrada en",
      render: (r) =>
        r.cerrada_en ? new Date(r.cerrada_en).toLocaleDateString("es-PE") : <span className="text-text-espresso-soft">—</span>,
    },
    {
      key: "acciones",
      header: "Acciones",
      render: (r) => (
        <a href={`/liquidaciones/${r.id}`} className="text-primary underline-offset-4 hover:underline">Ver detalle</a>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-playfair text-primary text-[38px] font-semibold">Liquidaciones</h1>
        {canManage && <NewLiquidacionButton />}
      </div>
      <DataTable columns={columns} data={liquidaciones} emptyState="No hay liquidaciones registradas." />
    </div>
  );
}