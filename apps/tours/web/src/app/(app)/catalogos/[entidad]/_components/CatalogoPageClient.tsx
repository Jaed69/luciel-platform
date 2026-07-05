"use client";
import { useState } from "react";
import { Button } from "@/components/Button";
import { DataTable, type Column } from "@/components/DataTable";
import { CatalogoFormModal } from "@/components/CatalogoFormModal";
import { showToast } from "@/components/Toast";

type Row = { id: number; codigo?: string; nombre: string; activo: boolean };

const ENTIDADES = ["agencias", "tours", "vendedores", "formas-pago", "monedas", "comisiones"] as const;
const ENTIDAD_LABEL: Record<string, string> = {
  agencias: "agencia",
  tours: "tour",
  vendedores: "vendedor",
  "formas-pago": "forma de pago",
  monedas: "moneda",
};

export function CatalogoPageClient({ data, entidad, label }: { data: Row[]; entidad: string; label: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Row | null>(null);

  function openCreate() {
    setEditTarget(null);
    setModalOpen(true);
  }
  function openEdit(row: Row) {
    setEditTarget(row);
    setModalOpen(true);
  }

  async function handleRestore(row: Row) {
    if (!window.confirm(`¿Restaurar ${row.nombre}?`)) return;
    const res = await fetch(`/api/catalogos/${entidad}/${row.id}`, { method: "POST" });
    if (res.ok) {
      window.location.reload();
    } else {
      try {
        const err = await res.json();
        const detail = err.detail;
        const msg = typeof detail === "string" ? detail : (detail?.mensaje ?? "Error al restaurar");
        showToast("error", msg);
      } catch {
        showToast("error", "Error al restaurar");
      }
    }
  }

  const columns: Column<Row>[] = [
    { key: "codigo", header: "Código", render: (r) => r.codigo ?? "—" },
    { key: "nombre", header: "Nombre", render: (r) => r.nombre },
    {
      key: "estado",
      header: "Estado",
      render: (r) => (r.activo ? "Activo" : <span className="opacity-60">Inactivo</span>),
    },
    {
      key: "acciones",
      header: "Acciones",
      render: (r) => (
        <span className="flex gap-3">
          <button type="button" className="text-primary hover:underline" onClick={() => openEdit(r)}>Editar</button>
          {!r.activo ? (
            <button type="button" className="text-primary hover:underline" onClick={() => handleRestore(r)}>Restaurar</button>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-playfair text-primary text-[38px] font-semibold capitalize">{entidad.replace("-", " ")}</h1>
        <Button variant="primary" onClick={openCreate}>Agregar {label}</Button>
      </div>
      <nav className="flex gap-2 mb-4 flex-wrap" aria-label="Catálogos sub-nav">
        {ENTIDADES.map((e) => (
          <a
            key={e}
            href={`/catalogos/${e}`}
            className={`px-3 py-1.5 rounded-full text-sm font-nunito font-semibold ${e === entidad ? "bg-primary text-on-primary" : "text-primary border border-gold/30"}`}
          >
            {e.replace("-", " ")}
          </a>
        ))}
      </nav>
      <DataTable
        columns={columns}
        data={data}
        emptyState={`No hay ${entidad} cargadas todavía.`}
      />
      <CatalogoFormModal
        entidad={entidad}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editTarget}
        onSaved={() => {
          setModalOpen(false);
          window.location.reload();
        }}
      />
    </div>
  );
}