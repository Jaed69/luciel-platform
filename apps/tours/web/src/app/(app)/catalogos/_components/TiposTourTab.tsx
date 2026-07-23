// apps/tours/web/src/app/(app)/catalogos/_components/TiposTourTab.tsx
// D-29 — dedicated tab for tipos de tour (codigo/nombre/descripcion/tiempo/precio),
// split out of the generic catalog CRUD which only ever handled codigo/nombre.
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { DataTable, type Column } from "@/components/DataTable";
import { showToast } from "@/components/Toast";

export type TipoTourRow = {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tiempo: string | null;
  precio_default: number | null;
  precio_default_usd: number | null;
  moneda_default: string;
  activo: boolean;
};

function SubNavTabs({ tabs, entidad }: { tabs: string[]; entidad: string }) {
  return (
    <nav className="flex flex-wrap gap-2 mb-4" aria-label="Catálogos sub-nav">
      {tabs.map((label) => (
        <a
          key={label}
          href={`/catalogos/${label}`}
          className={`px-3 py-1.5 rounded-full text-sm font-nunito font-semibold ${label === entidad ? "bg-primary text-on-primary" : "text-primary border border-gold/30"}`}
        >
          {label.replace("-", " ")}
        </a>
      ))}
    </nav>
  );
}

function TipoTourFormModal({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: TipoTourRow | null;
  onSaved: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tiempo, setTiempo] = useState("");
  const [precioDefault, setPrecioDefault] = useState("");
  const [precioDefaultUsd, setPrecioDefaultUsd] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setCodigo(initial?.codigo ?? "");
      setNombre(initial?.nombre ?? "");
      setDescripcion(initial?.descripcion ?? "");
      setTiempo(initial?.tiempo ?? "");
      setPrecioDefault(initial?.precio_default != null ? String(initial.precio_default) : "");
      setPrecioDefaultUsd(initial?.precio_default_usd != null ? String(initial.precio_default_usd) : "");
    }
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const body = {
      codigo,
      nombre,
      descripcion: descripcion || null,
      tiempo: tiempo || null,
      precio_default: precioDefault ? Number(precioDefault) : null,
      precio_default_usd: precioDefaultUsd ? Number(precioDefaultUsd) : null,
      moneda_default: "PEN",
    };
    const url = initial ? `/api/tours/${initial.id}` : "/api/tours";
    const method = initial ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (res.ok) {
      showToast("success", initial ? "Tipo de tour actualizado" : "Tipo de tour creado");
      onSaved();
      onClose();
    } else {
      showToast("error", "Error al guardar");
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxW="md">
      <h2 className="font-playfair text-primary text-2xl font-semibold mb-4">
        {initial ? "Editar tipo de tour" : "Nuevo tipo de tour"}
      </h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Código</span>
          <input required value={codigo} onChange={(e) => setCodigo(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" />
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Nombre</span>
          <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" />
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Descripción</span>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" rows={3} />
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Tiempo</span>
          <input value={tiempo} onChange={(e) => setTiempo(e.target.value)} placeholder="ej. 3 horas, Full day" className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" />
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Precio (PEN)</span>
          <input type="number" step="0.01" value={precioDefault} onChange={(e) => setPrecioDefault(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" />
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Precio (USD)</span>
          <input type="number" step="0.01" value={precioDefaultUsd} onChange={(e) => setPrecioDefaultUsd(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" />
        </label>
        <div className="flex gap-3 justify-end mt-2">
          <Button variant="outlined" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function TiposTourTab({ tours, tabs }: { tours: TipoTourRow[]; tabs: string[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TipoTourRow | null>(null);

  function openCreate() {
    setEditTarget(null);
    setModalOpen(true);
  }
  function openEdit(row: TipoTourRow) {
    setEditTarget(row);
    setModalOpen(true);
  }

  async function handleDelete(row: TipoTourRow) {
    if (!window.confirm(`¿Eliminar ${row.nombre}?`)) return;
    const res = await fetch(`/api/tours/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      window.location.reload();
    } else {
      try {
        const err = await res.json();
        const detail = err.detail;
        const msg = typeof detail === "string" ? detail : (detail?.mensaje ?? "Error al eliminar");
        showToast("error", msg);
      } catch {
        showToast("error", "Error al eliminar");
      }
    }
  }

  async function handleRestore(row: TipoTourRow) {
    const res = await fetch(`/api/tours/${row.id}/restore`, { method: "POST" });
    if (res.ok) {
      window.location.reload();
    } else {
      showToast("error", "Error al restaurar");
    }
  }

  const columns: Column<TipoTourRow>[] = [
    { key: "nombre", header: "Nombre", render: (r) => r.nombre },
    { key: "tiempo", header: "Tiempo", render: (r) => r.tiempo ?? "—" },
    { key: "precio_pen", header: "Precio (PEN)", render: (r) => (r.precio_default != null ? `S/ ${r.precio_default}` : "—") },
    { key: "precio_usd", header: "Precio (USD)", render: (r) => (r.precio_default_usd != null ? `$ ${r.precio_default_usd}` : "—") },
    { key: "estado", header: "Estado", render: (r) => (r.activo ? "Activo" : <span className="opacity-60">Inactivo</span>) },
    {
      key: "acciones",
      header: "Acciones",
      render: (r) => (
        <span className="flex gap-3">
          <button type="button" className="text-primary hover:underline" onClick={() => openEdit(r)}>Editar</button>
          {r.activo ? (
            <button type="button" className="text-chili-red hover:underline" onClick={() => handleDelete(r)}>Eliminar</button>
          ) : (
            <button type="button" className="text-primary hover:underline" onClick={() => handleRestore(r)}>Restaurar</button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-playfair text-primary text-[38px] font-semibold">Tipos de tour</h1>
        <Button variant="primary" onClick={openCreate}>Nuevo tipo de tour</Button>
      </div>
      <SubNavTabs tabs={tabs} entidad="tours" />
      <DataTable columns={columns} data={tours} emptyState="No hay tipos de tour cargados todavía." />
      <TipoTourFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editTarget}
        onSaved={() => window.location.reload()}
      />
    </div>
  );
}
