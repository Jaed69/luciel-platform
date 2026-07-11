"use client";
import { useState } from "react";
import { formatCurrency } from "@/lib/api";
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
};

export function VentaTable({ ventas }: { ventas: Venta[] }) {
  const [editTarget, setEditTarget] = useState<Venta | null>(null);

  async function handleDelete(v: Venta) {
    if (!window.confirm(`¿Eliminar venta #${v.id}?`)) return;
    const res = await fetch(`/api/ventas/${v.id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("success", "Venta eliminada");
      window.location.reload();
    } else {
      try {
        const err = await res.json();
        const detail = err.detail;
        const msg = typeof detail === "string" ? detail : "Error al eliminar";
        showToast("error", msg);
      } catch {
        showToast("error", "Error al eliminar");
      }
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
      render: (r) => (r.liquidacion_id ? `LIQ-${r.liquidacion_id}` : <span className="text-text-espresso-soft">—</span>),
    },
    {
      key: "acciones",
      header: "Acciones",
      render: (r) =>
        r.liquidacion_id ? (
          <span className="text-chili-red text-[13px]">Tour en liquidación cerrada. Reabre la liquidación para editar.</span>
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