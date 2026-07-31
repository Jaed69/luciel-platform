"use client";
import { useState } from "react";
import { Button } from "@/components/Button";
import { DataTable, type Column } from "@/components/DataTable";
import { CatalogoFormModal } from "@/components/CatalogoFormModal";
import { showToast } from "@/components/Toast";

type Row = {
  id: number;
  codigo?: string;
  nombre: string;
  tipo?: string | null;
  activo: boolean;
  estado?: string | null;
  usuario_activo?: boolean | null;
};

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
  // D-32 — vendedores are now derived from Usuarios (rol vendedor); this tab
  // is read-only for them, alta/edición happens in /admin/usuarios.
  const readOnly = entidad === "vendedores";

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

  async function handleDelete(row: Row) {
    const isHardDelete = entidad === "monedas";
    const confirmMsg = isHardDelete
      ? "Esta acción es permanente y no se puede deshacer."
      : `¿Desactivar ${row.nombre}? Podrás restaurarlo luego.`;
    if (!window.confirm(confirmMsg)) return;
    const res = await fetch(`/api/catalogos/${entidad}/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      window.location.reload();
    } else {
      try {
        const err = await res.json();
        const detail = err.detail;
        let msg = typeof detail === "string" ? detail : (detail?.mensaje ?? "Error al eliminar");
        if (detail?.referencias && Array.isArray(detail.referencias)) {
          const refsTxt = detail.referencias.map((r: any) => `${r.tabla}: ${r.count}`).join(", ");
          msg = `${msg} (${refsTxt})`;
        }
        showToast("error", msg);
      } catch {
        showToast("error", "Error al eliminar");
      }
    }
  }

  const columns: Column<Row>[] = [
    { key: "codigo", header: "Código", render: (r) => r.codigo ?? "—" },
    { key: "nombre", header: "Nombre", render: (r) => r.nombre },
    ...(entidad === "agencias"
      ? [
          {
            key: "tipo",
            header: "Tipo",
            render: (r: Row) =>
              r.tipo === "proveedor_transporte" ? (
                <span className="inline-block rounded-md px-3 py-1 text-[13px] font-semibold border border-gold bg-gold/10">
                  Transporte
                </span>
              ) : (
                <span className="inline-block rounded-md px-3 py-1 text-[13px] border border-gold/40">Tours</span>
              ),
          } as Column<Row>,
          {
            key: "estado_operativo",
            header: "Estado operativo",
            render: (r: Row) =>
              r.estado === "operativa" ? (
                <span className="inline-block rounded-md px-3 py-1 text-[13px] font-semibold border bg-green-100 text-green-700 border-green-300">
                  Operativa
                </span>
              ) : r.estado === "sin_tours_vinculados" ? (
                <span className="inline-block rounded-md px-3 py-1 text-[13px] font-semibold border bg-amber-warning/20 text-amber-warning border-amber-warning">
                  Sin tours vinculados
                </span>
              ) : (
                // El estado operativo mide convenios por tour: a un proveedor de
                // transporte no le aplica.
                <span className="text-text-espresso-soft text-[13px]">—</span>
              ),
          } as Column<Row>,
        ]
      : []),
    ...(entidad !== "monedas" && entidad !== "vendedores"
      ? [
          {
            key: "estado",
            header: "Estado",
            render: (r: Row) => (r.activo ? "Activo" : <span className="opacity-60">Inactivo</span>),
          } as Column<Row>,
        ]
      : []),
    ...(entidad === "vendedores"
      ? [
          {
            key: "estado_usuario",
            header: "Estado",
            render: (r: Row) =>
              r.usuario_activo === null || r.usuario_activo === undefined ? (
                <span className="opacity-60" title="Sin usuario vinculado">—</span>
              ) : r.usuario_activo ? (
                "Activo"
              ) : (
                <span className="opacity-60">Inactivo</span>
              ),
          } as Column<Row>,
        ]
      : []),
    {
      key: "acciones",
      header: "Acciones",
      render: (r) =>
        readOnly ? (
          <span title="Gestionado desde Usuarios">🔒</span>
        ) : (
          <span className="flex gap-3">
            <button type="button" className="text-primary hover:underline" onClick={() => openEdit(r)}>Editar</button>
            {entidad === "agencias" ? (
              <a href={`/agencias/${r.id}`} className="text-primary hover:underline">Costos</a>
            ) : null}
            {entidad !== "monedas" && !r.activo ? (
              <button type="button" className="text-primary hover:underline" onClick={() => handleRestore(r)}>Restaurar</button>
            ) : null}
            <button type="button" className="text-primary hover:underline" onClick={() => handleDelete(r)}>Eliminar</button>
          </span>
        ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-playfair text-primary text-[38px] font-semibold capitalize">{entidad.replace("-", " ")}</h1>
          {entidad === "vendedores" ? (
            <p className="text-sm font-nunito text-text-espresso-soft">
              Los vendedores se gestionan desde Usuarios (rol vendedor).
            </p>
          ) : null}
        </div>
        {readOnly ? (
          <a href="/admin/usuarios" className="text-sm font-nunito text-primary hover:underline">
            Gestionar desde Usuarios →
          </a>
        ) : (
          <Button variant="primary" onClick={openCreate}>Agregar {label}</Button>
        )}
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