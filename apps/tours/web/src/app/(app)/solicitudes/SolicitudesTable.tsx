"use client";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { showToast } from "@/components/Toast";

export type SolicitudRow = {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: string;
  prioridad: string;
  estado: string;
  pagina_origen: string | null;
  creado_por: number;
  creado_en: string;
  respuesta: string | null;
  resuelto_por: number | null;
  resuelto_en: string | null;
};

const ESTADOS = ["abierto", "en_revision", "resuelto", "descartado"] as const;

function ResolverModal({ solicitud, onClose, onSaved }: { solicitud: SolicitudRow; onClose: () => void; onSaved: () => void }) {
  const [estado, setEstado] = useState(solicitud.estado);
  const [respuesta, setRespuesta] = useState(solicitud.respuesta ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const res = await fetch(`/api/solicitudes/${solicitud.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado, respuesta: respuesta || null }),
    });
    setSubmitting(false);
    if (res.ok) {
      showToast("success", "Solicitud actualizada");
      onSaved();
      onClose();
    } else {
      showToast("error", "Error al actualizar");
    }
  }

  return (
    <Modal open onClose={onClose} maxW="md">
      <h2 className="font-playfair text-primary text-2xl font-semibold mb-4">{solicitud.titulo}</h2>
      <p className="font-nunito text-text-espresso-soft mb-4">{solicitud.descripcion}</p>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Estado</span>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas"
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Respuesta</span>
          <textarea
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas"
            rows={4}
          />
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

export function SolicitudesTable({ solicitudes, isAdmin }: { solicitudes: SolicitudRow[]; isAdmin: boolean }) {
  const [resolverTarget, setResolverTarget] = useState<SolicitudRow | null>(null);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gold/30">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-primary text-on-primary">
            <tr>
              <th className="text-left px-3 py-2 text-sm font-semibold border-b border-gold">Título</th>
              <th className="text-left px-3 py-2 text-sm font-semibold border-b border-gold">Tipo</th>
              <th className="text-left px-3 py-2 text-sm font-semibold border-b border-gold">Prioridad</th>
              <th className="text-left px-3 py-2 text-sm font-semibold border-b border-gold">Estado</th>
              {isAdmin && <th className="text-left px-3 py-2 text-sm font-semibold border-b border-gold">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s, i) => (
              <tr key={s.id} className={i % 2 === 1 ? "bg-stone-wall/30" : "bg-canvas"}>
                <td className="px-3 py-2 text-[13px]">{s.titulo}</td>
                <td className="px-3 py-2 text-[13px]">{s.tipo}</td>
                <td className="px-3 py-2 text-[13px]">{s.prioridad}</td>
                <td className="px-3 py-2 text-[13px]">
                  <StatusBadge variant={s.estado as any}>{s.estado}</StatusBadge>
                </td>
                {isAdmin && (
                  <td className="px-3 py-2 text-[13px]">
                    <button type="button" className="text-primary hover:underline" onClick={() => setResolverTarget(s)}>
                      Resolver
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {resolverTarget && (
        <ResolverModal
          solicitud={resolverTarget}
          onClose={() => setResolverTarget(null)}
          onSaved={() => window.location.reload()}
        />
      )}
    </div>
  );
}
