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
};

// D-14 bloquea sólo la liquidación *cerrada*. Una `abierta` es todavía un
// agrupamiento editable (y es justamente donde hay que poder corregir un costo
// faltante para que el pre-check pase), y una `revertida` ya liberó sus tours.
function estaBloqueada(v: Venta): boolean {
  return v.liquidacion_id != null && v.liquidacion_estado === "cerrada";
}

export function VentaTable({ ventas }: { ventas: Venta[] }) {
  const [editTarget, setEditTarget] = useState<Venta | null>(null);

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
    { key: "fecha", header: "Fecha", render: (r) => new Date(r.fecha).toLocaleDateString("es-PE") },
    { key: "tour_id", header: "Tour", render: (r) => `T-${r.tour_id}` },
    { key: "vendedor_id", header: "Vendedor", render: (r) => `V-${r.vendedor_id}` },
    { key: "agencia_id", header: "Agencia", render: (r) => `AG-${r.agencia_id}` },
    { key: "forma_pago_id", header: "Forma de pago", render: (r) => `FP-${r.forma_pago_id}` },
    { key: "moneda", header: "Moneda", render: (r) => r.moneda },
    {
      key: "monto",
      header: "Monto",
      render: (r) => <span className="tabular-nums">{formatCurrency(r.monto, r.moneda)}</span>,
    },
    { key: "comision", header: "Comisión estimada", render: () => <span className="text-text-espresso-soft">—</span> },
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
        emptyState="No hay ventas registradas. Usa el botón Registrar venta para crear la primera."
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