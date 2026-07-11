// apps/tours/web/src/app/(app)/catalogos/_components/ComisionesTab.tsx
// S5 — Comisiones tab content: sub-nav tabs + reglas table with Origen column.
"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { DataTable, type Column } from "@/components/DataTable";
import { ComisionReglaFormModal } from "./ComisionReglaFormModal";
import { showToast } from "@/components/Toast";

export type ComisionReglaRow = {
  id: number;
  vendedor_id: number | null;
  tour_id: number | null;
  porcentaje: number;
  descripcion: string | null;
  activo: boolean;
};

function origenOf(r: ComisionReglaRow): string {
  if (r.vendedor_id != null && r.tour_id != null) return "vendedor+tour";
  if (r.vendedor_id != null) return "vendedor";
  if (r.tour_id != null) return "tour";
  return "global";
}

function SubNavTabs({ tabs, active = "Comisiones" }: { tabs: string[]; active?: string }) {
  return (
    <nav className="flex flex-wrap gap-2 mb-4" aria-label="Catálogos sub-nav">
      {tabs.map((label) => {
        const isComisiones = label === "Comisiones";
        const cls = isComisiones ? "bg-primary text-on-primary" : "text-primary border border-gold/30";
        return (
          <span
            key={label}
            className={`px-3 py-1.5 rounded-full text-sm font-nunito font-semibold ${cls}`}
          >
            {label}
          </span>
        );
      })}
    </nav>
  );
}

export function ComisionesTab({ reglas, tabs }: { reglas: ComisionReglaRow[]; tabs: string[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ComisionReglaRow | null>(null);

  function openCreate() {
    setEditTarget(null);
    setModalOpen(true);
  }
  function openEdit(r: ComisionReglaRow) {
    setEditTarget(r);
    setModalOpen(true);
  }

  async function handleDelete(r: ComisionReglaRow) {
    if (!window.confirm(`¿Eliminar regla (${origenOf(r)}, ${r.porcentaje}%)?`)) return;
    const res = await fetch(`/api/comision-reglas/${r.id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("success", "Regla eliminada");
      window.location.reload();
    } else {
      try {
        const err = await res.json();
        const msg = typeof err.detail === "string" ? err.detail : "Error al eliminar";
        showToast("error", msg);
      } catch {
        showToast("error", "Error al eliminar");
      }
    }
  }

  const columns: Column<ComisionReglaRow>[] = [
    { key: "vendedor_id", header: "Vendedor", render: (r) => (r.vendedor_id != null ? `V-${r.vendedor_id}` : "—") },
    { key: "tour_id", header: "Tour", render: (r) => (r.tour_id != null ? `T-${r.tour_id}` : "—") },
    { key: "porcentaje", header: "Porcentaje", render: (r) => `${r.porcentaje}%` },
    { key: "origen", header: "Origen", render: (r) => <span>{origenOf(r)}</span> },
    {
      key: "acciones",
      header: "Editar · Eliminar",
      render: (r) =>
        r.vendedor_id == null && r.tour_id == null ? (
          <button
            type="button"
            disabled
            title="Regla global por defecto — no eliminable"
            aria-label="Eliminar regla"
            className="text-chili-red text-sm font-nunito opacity-50 cursor-not-allowed"
          >
            Eliminar
          </button>
        ) : (
          <span className="flex gap-3">
            <button type="button" className="text-primary hover:underline" onClick={() => openEdit(r)}>Editar</button>
            <button type="button" className="text-chili-red hover:underline" onClick={() => handleDelete(r)}>Eliminar</button>
          </span>
        ),
    },
  ];
  return (
    <div>
      <SubNavTabs tabs={tabs} />
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-playfair text-primary text-[28px] font-semibold">Comisiones</h2>
        <Button variant="primary" onClick={openCreate}>Agregar regla</Button>
      </div>
      <DataTable columns={columns} data={reglas} emptyState="No hay reglas de comisión configuradas." />
      <ComisionReglaFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editTarget}
        onSaved={() => window.location.reload()}
      />
    </div>
  );
}