// apps/tours/web/src/app/(app)/liquidaciones/[id]/page.tsx
// S4 — Liquidación detail: header + pre-check strip + tours table + footer actions.
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiFetchJson } from "@/lib/api";
import { redirect } from "next/navigation";
import { Button } from "@/components/Button";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { CloseModal } from "./components/CloseModal";
import { ReopenModal } from "./components/ReopenModal";

type Liquidacion = {
  id: number;
  codigo: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  estado: "abierta" | "cerrada" | "revertida";
  vendedor_id: number | null;
  agencia_id: number | null;
  cerrada_en: string | null;
};

type Precheck = { fails: { tour_id: number; problema: string }[]; warnings: { tour_id: number; problema: string }[] };

type TourRow = {
  id: number;
  tour_id: number;
  vendedor_id: number;
  agencia_id: number;
  moneda: "PEN" | "USD";
  monto: number;
  costo: number | null;
  fecha: string;
  liquidacion_id: number | null;
};

export default async function LiquidacionDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string;

  const liqId = Number(params.id);
  const [liq, precheck, tours] = await Promise.all([
    apiFetchJson<Liquidacion>(`/liquidaciones/${liqId}`).catch(() => null),
    apiFetchJson<Precheck>(`/liquidaciones/${liqId}/precheck`).catch(() => null as Precheck | null),
    apiFetchJson<TourRow[]>(`/ventas?`).then((rows) => rows.filter((r) => r.liquidacion_id === liqId)).catch(() => []),
  ]);

  if (!liq) {
    redirect("/liquidaciones");
  }

  const canManage = role === "admin" || role === "contabilidad";
  const hasBlockers = !!(precheck && precheck.fails.length > 0);

  const tourColumns: Column<TourRow>[] = [
    { key: "fecha", header: "Fecha", render: (r) => new Date(r.fecha).toLocaleDateString("es-PE") },
    { key: "tour_id", header: "Tour", render: (r) => `T-${r.tour_id}` },
    { key: "vendedor_id", header: "Vendedor", render: (r) => `V-${r.vendedor_id}` },
    {
      key: "monto",
      header: "Monto",
      render: (r) => <span className="tabular-nums">{r.monto.toFixed(2)} {r.moneda}</span>,
    },
    {
      key: "costo",
      header: "Costo",
      render: (r) => (
        <span className={`tabular-nums ${r.costo == null ? "text-chili-red" : ""}`}>
          {r.costo == null ? "faltante" : r.costo.toFixed(2)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <h1 className="font-playfair text-primary text-[28px] font-semibold">{liq.codigo ?? `Liquidación #${liq.id}`}</h1>
        <StatusBadge variant={liq.estado}>{liq.estado}</StatusBadge>
        <span className="text-[13px] font-nunito tabular-nums text-text-espresso-soft">
          {new Date(liq.fecha_desde).toLocaleDateString("es-PE")} → {new Date(liq.fecha_hasta).toLocaleDateString("es-PE")}
        </span>
      </div>

      {liq.estado === "abierta" && precheck && (
        <section>
          {precheck.fails.map((f, i) => (
            <div key={i} className="text-[13px] font-nunito text-chili-red mb-1">
              ⚠️ T-{f.tour_id}: {f.problema === "costo_faltante" ? "sin costo cargado" : f.problema}
            </div>
          ))}
          {precheck.warnings.map((w, i) => (
            <div key={i} className="text-[13px] font-nunito text-amber-warning mb-1">
              ⓘ T-{w.tour_id}: conversión TC interno pendiente (USD sin paso previo)
            </div>
          ))}
          {precheck.fails.length === 0 && precheck.warnings.length === 0 && (
            <p className="text-[13px] font-nunito text-text-espresso-soft">Pre-check OK. Listo para cerrar.</p>
          )}
        </section>
      )}

      <section>
        <h2 className="font-playfair text-primary text-[20px] font-semibold mb-2">Tours en esta liquidación</h2>
        <DataTable columns={tourColumns} data={tours} emptyState="Sin tours asignados a esta liquidación." />
      </section>

      {canManage && (
        <section className="flex gap-3 pt-3">
          {liq.estado === "abierta" && <CloseModal liquidacion={liq} disabled={hasBlockers} />}
          {liq.estado === "cerrada" && <ReopenModal liquidacion={liq} />}
        </section>
      )}
    </div>
  );
}