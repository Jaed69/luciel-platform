// apps/tours/web/src/app/(app)/page.tsx
// S2 — Dashboard contable: 4 content-cards + filter bar + saldos table + tours pendientes.
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiFetchJson } from "@/lib/api";
import { Button } from "@/components/Button";
import { DataTable, type Column } from "@/components/DataTable";
import { DashboardCards, type SaldosRow } from "./_components/DashboardCards";

type PendienteRow = {
  id: number;
  tour_id: number;
  vendedor_id: number;
  agencia_id: number;
  moneda: "PEN" | "USD";
  monto: number;
  costo: number | null;
  fecha: string;
  dias_desde_venta: number;
};

function diasClass(d: number): string {
  if (d >= 90) return "text-chili-red font-bold animate-pulse";
  if (d >= 60) return "text-chili-red font-bold";
  if (d >= 30) return "text-chili-red font-semibold";
  return "text-text-espresso";
}

export default async function AppHome({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (role === "vendedor") redirect("/ventas");

  // Default range: 30 days back to today.
  const today = new Date();
  const back30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fecha_desde = searchParams.fecha_desde || back30.toISOString().slice(0, 10);
  const fecha_hasta = searchParams.fecha_hasta || today.toISOString().slice(0, 10);

  const qs = new URLSearchParams({ fecha_desde, fecha_hasta });
  if (searchParams.agencia) qs.set("agencia_id", searchParams.agencia);
  if (searchParams.vendedor) qs.set("vendedor_id", searchParams.vendedor);
  if (searchParams.moneda) qs.set("moneda", searchParams.moneda);

  const [saldos, pendientes] = await Promise.all([
    apiFetchJson<SaldosRow[]>(`/dashboard/saldos?${qs.toString()}`).catch(() => []),
    apiFetchJson<PendienteRow[]>(`/dashboard/tours_pendientes?${qs.toString()}`).catch(() => []),
  ]);

  const saldosColumns: Column<SaldosRow & { total_debe?: number; total_haber?: number }>[] = [
    { key: "codigo", header: "Cuenta", render: (r) => r.codigo ?? r.nombre },
    { key: "moneda", header: "Moneda", render: (r) => r.moneda },
    {
      key: "total_debe",
      header: "Débito",
      render: (r) => <span className="tabular-nums">{Number(r.total_debe ?? 0).toFixed(2)}</span>,
    },
    {
      key: "total_haber",
      header: "Haber",
      render: (r) => <span className="tabular-nums">{Number(r.total_haber ?? 0).toFixed(2)}</span>,
    },
    {
      key: "saldo",
      header: "Saldo",
      render: (r) => {
        const s = Number(r.saldo ?? 0);
        return (
          <span className={`tabular-nums ${s < 0 ? "text-chili-red font-semibold" : "text-text-espresso"}`}>
            {s.toFixed(2)}
          </span>
        );
      },
    },
  ];

  const pendientesColumns: Column<PendienteRow>[] = [
    { key: "fecha", header: "Fecha", render: (r) => new Date(r.fecha).toLocaleDateString("es-PE") },
    { key: "tour_id", header: "Tour", render: (r) => `T-${r.tour_id}` },
    { key: "vendedor_id", header: "Vendedor", render: (r) => `V-${r.vendedor_id}` },
    {
      key: "monto",
      header: "Monto",
      render: (r) => <span className="tabular-nums">{r.monto.toFixed(2)} {r.moneda}</span>,
    },
    {
      key: "dias_desde_venta",
      header: "Días desde venta",
      render: (r) => <span className={diasClass(r.dias_desde_venta)}>{r.dias_desde_venta}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-playfair text-primary text-[38px] font-semibold">Resumen contable</h1>

      <form className="bg-canvas rounded-xl shadow-lg p-4 border border-gold/30 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col">
          <label htmlFor="fecha_desde" className="text-sm font-nunito font-semibold text-text-espresso-soft mb-1">Fecha desde</label>
          <input id="fecha_desde" type="date" name="fecha_desde" defaultValue={fecha_desde} className="border border-gold/40 rounded px-2 py-1.5 text-sm font-nunito" />
        </div>
        <div className="flex flex-col">
          <label htmlFor="fecha_hasta" className="text-sm font-nunito font-semibold text-text-espresso-soft mb-1">Fecha hasta</label>
          <input id="fecha_hasta" type="date" name="fecha_hasta" defaultValue={fecha_hasta} className="border border-gold/40 rounded px-2 py-1.5 text-sm font-nunito" />
        </div>
        <div className="flex flex-col">
          <label htmlFor="agencia" className="text-sm font-nunito font-semibold text-text-espresso-soft mb-1">Agencia</label>
          <select id="agencia" name="agencia" defaultValue={searchParams.agencia ?? ""} className="border border-gold/40 rounded px-2 py-1.5 text-sm font-nunito">
            <option value="">Todas</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label htmlFor="vendedor" className="text-sm font-nunito font-semibold text-text-espresso-soft mb-1">Vendedor</label>
          <select id="vendedor" name="vendedor" defaultValue={searchParams.vendedor ?? ""} className="border border-gold/40 rounded px-2 py-1.5 text-sm font-nunito">
            <option value="">Todos</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label htmlFor="moneda" className="text-sm font-nunito font-semibold text-text-espresso-soft mb-1">Moneda</label>
          <select id="moneda" name="moneda" defaultValue={searchParams.moneda ?? ""} className="border border-gold/40 rounded px-2 py-1.5 text-sm font-nunito">
            <option value="">Ambas</option>
            <option value="PEN">PEN</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <Button variant="primary" size="sm" type="submit">Aplicar filtros</Button>
        <Button variant="outlined" size="sm" type="reset">Limpiar filtros</Button>
      </form>

      <DashboardCards saldos={saldos} />

      <section>
        <h2 className="font-playfair text-primary text-[24px] font-semibold mb-3">Saldos por cuenta</h2>
        <DataTable columns={saldosColumns} data={saldos} emptyState="Sin movimientos para este filtro" />
      </section>

      <section>
        <h2 className="font-playfair text-primary text-[24px] font-semibold mb-3">Tours pendientes de liquidación</h2>
        <DataTable columns={pendientesColumns} data={pendientes} emptyState="Todos los tours están liquidados." />
      </section>
    </div>
  );
}