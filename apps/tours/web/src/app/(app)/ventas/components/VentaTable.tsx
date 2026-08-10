"use client";
import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { DataTable, type Column } from "@/components/DataTable";
import { VentaEditModal } from "./VentaEditModal";
import { showToast } from "@/components/Toast";

type Venta = {
  id: number;
  tour_id: number;
  vendedor_id: number;
  agencia_id: number;
  forma_pago_id: number;
  moneda: "PEN" | "USD";
  monto: number;
  costo: number | null;
  fecha: string;
  asiento_id: number;
  liquidacion_id: number | null;
  liquidacion_estado?: "abierta" | "cerrada" | "revertida" | null;
  liquidacion_codigo?: string | null;
  // D-34 — presentes sólo en filas de tipo traslado.
  tipo_servicio?: "tour" | "traslado";
  fecha_servicio?: string | null;
  destino?: string | null;
  nombre_huesped?: string | null;
  numero_habitacion?: string | null;
  hora?: string | null;
  observaciones?: string | null;
  // D-35 — presentes sólo en filas de tipo tour.
  cantidad_pasajeros?: number;
  nombre_pasajero?: string | null;
};

type Catalogo = { id: number; nombre: string };

// D-14 bloquea sólo la liquidación *cerrada*. Una `abierta` es todavía un
// agrupamiento editable (y es justamente donde hay que poder corregir un costo
// faltante para que el pre-check pase), y una `revertida` ya liberó sus tours.
function estaBloqueada(v: Venta): boolean {
  return v.liquidacion_id != null && v.liquidacion_estado === "cerrada";
}

export function VentaTable({
  ventas,
  tours = [],
  vendedores = [],
  agencias = [],
}: {
  ventas: Venta[];
  tours?: Catalogo[];
  vendedores?: Catalogo[];
  agencias?: Catalogo[];
}) {
  const [editTarget, setEditTarget] = useState<Venta | null>(null);
  const tourNombre = (id: number) => tours.find((t) => t.id === id)?.nombre ?? `T-${id}`;
  const vendedorNombre = (id: number) => vendedores.find((v) => v.id === id)?.nombre ?? `V-${id}`;
  const agenciaNombre = (id: number) => agencias.find((a) => a.id === id)?.nombre ?? `AG-${id}`;

  async function handleDelete(v: Venta) {
    const enLiquidacion =
      v.liquidacion_id != null
        ? `\n\nEstá asignada a la liquidación ${v.liquidacion_codigo ?? `#${v.liquidacion_id}`} (abierta): se quitará de ella.`
        : "";
    if (!window.confirm(`¿Eliminar venta #${v.id}?\n\nSe registrará un asiento de reversión para dejar los saldos en cero.${enLiquidacion}`)) return;
    const res = await fetch(`/api/ventas/${v.id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("success", "Venta eliminada");
      window.location.reload();
    } else {
      showToast("error", await errorMessage(res, "Error al eliminar"));
    }
  }

  const columns: Column<Venta>[] = [
    // Dos fechas distintas en un traslado (D-34): la de cobro es la contable y
    // la de servicio la operativa. Se muestran separadas para no confundirlas.
    { key: "fecha", header: "Fecha de cobro", render: (r) => new Date(r.fecha).toLocaleDateString("es-PE") },
    {
      key: "fecha_servicio",
      header: "Fecha del servicio",
      render: (r) =>
        r.tipo_servicio === "traslado" && r.fecha_servicio ? (
          <span>
            {new Date(r.fecha_servicio).toLocaleDateString("es-PE")}
            {r.hora ? <span className="text-text-espresso-soft"> {r.hora}</span> : null}
          </span>
        ) : (
          <span className="text-text-espresso-soft">—</span>
        ),
    },
    {
      key: "detalle",
      header: "Detalle",
      // Un traslado se identifica por a dónde va y quién viaja; un tour, por
      // su fila de catálogo.
      render: (r) =>
        r.tipo_servicio === "traslado" ? (
          <span className="text-[13px]">
            {r.destino}
            <span className="text-text-espresso-soft">
              {" · "}{r.nombre_huesped}{r.numero_habitacion ? ` (hab. ${r.numero_habitacion})` : ""}
            </span>
          </span>
        ) : (
          <span className="text-[13px]">
            {tourNombre(r.tour_id)}
            {(r.nombre_pasajero || (r.cantidad_pasajeros ?? 1) > 1) && (
              <span className="text-text-espresso-soft">
                {" · "}
                {r.nombre_pasajero ?? "—"}
                {(r.cantidad_pasajeros ?? 1) > 1 ? ` (x${r.cantidad_pasajeros})` : ""}
              </span>
            )}
          </span>
        ),
    },
    { key: "vendedor_id", header: "Vendedor", render: (r) => vendedorNombre(r.vendedor_id) },
    { key: "agencia_id", header: "Proveedor", render: (r) => agenciaNombre(r.agencia_id) },
    { key: "forma_pago_id", header: "Forma de pago", render: (r) => `FP-${r.forma_pago_id}` },
    { key: "moneda", header: "Moneda", render: (r) => r.moneda },
    {
      key: "monto",
      header: "Monto",
      render: (r) => <span className="tabular-nums">{formatCurrency(r.monto, r.moneda)}</span>,
    },
    { key: "comision", header: "Comisión estimada", render: () => <span className="text-text-espresso-soft">—</span> },
    {
      key: "observaciones",
      header: "Notas",
      render: (r) => (r.observaciones ? <span className="text-[13px] text-text-espresso-soft">{r.observaciones}</span> : <span className="text-text-espresso-soft">—</span>),
    },
    {
      key: "liquidacion",
      header: "Liquidación",
      render: (r) =>
        r.liquidacion_id ? (
          <a href={`/liquidaciones/${r.liquidacion_id}`} className="text-primary underline-offset-4 hover:underline">
            {r.liquidacion_codigo ?? `#${r.liquidacion_id}`}
            {r.liquidacion_estado ? <span className="text-text-espresso-soft"> ({r.liquidacion_estado})</span> : null}
          </a>
        ) : (
          <span className="text-text-espresso-soft">—</span>
        ),
    },
    {
      key: "acciones",
      header: "Acciones",
      render: (r) =>
        estaBloqueada(r) ? (
          <span className="text-chili-red text-[13px]">
            Venta en liquidación cerrada.{" "}
            <a href={`/liquidaciones/${r.liquidacion_id}`} className="underline underline-offset-4">
              Reabre la liquidación
            </a>{" "}
            para editar.
          </span>
        ) : (
          <span className="flex gap-3">
            <button type="button" className="text-primary hover:underline" onClick={() => setEditTarget(r)}>Editar</button>
            <button type="button" className="text-chili-red hover:underline" onClick={() => handleDelete(r)}>Eliminar</button>
          </span>
        ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={ventas}
        emptyState="No hay nada registrado todavía en esta pestaña."
      />
      <VentaEditModal
        venta={editTarget}
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        onSaved={() => window.location.reload()}
      />
    </>
  );
}