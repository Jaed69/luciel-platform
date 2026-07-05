"use client";
import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { showToast } from "./Toast";

type CatalogoFormModalProps = {
  entidad: string;
  open: boolean;
  onClose: () => void;
  initial?: { id: number; codigo?: string; nombre: string } | null;
  onSaved: () => void;
};

const LABELS: Record<string, string> = {
  agencias: "agencia",
  tours: "tour",
  vendedores: "vendedor",
  "formas-pago": "forma de pago",
  monedas: "moneda",
};

export function CatalogoFormModal({ entidad, open, onClose, initial, onSaved }: CatalogoFormModalProps) {
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setCodigo(initial?.codigo ?? "");
      setNombre(initial?.nombre ?? "");
    }
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const url = initial ? `/api/catalogos/${entidad}/${initial.id}` : `/api/catalogos/${entidad}`;
    const method = initial ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo, nombre }),
    });
    setSubmitting(false);
    if (res.ok) {
      showToast("success", initial ? "Actualizado" : "Creado");
      onSaved();
      onClose();
    } else {
      try {
        const err = await res.json();
        const detail = err.detail;
        const msg = typeof detail === "string" ? detail : (detail?.mensaje ?? "Error");
        // 409 with detail.referencias (DELETE ref check shape) — surface the list:
        if (detail?.referencias && Array.isArray(detail.referencias)) {
          const refsTxt = detail.referencias.map((r: any) => `${r.tabla} (${r.count})`).join(", ");
          showToast("error", `${msg}: ${refsTxt}`);
        } else {
          showToast("error", msg);
        }
      } catch {
        showToast("error", "Error al guardar");
      }
    }
  }

  const label = LABELS[entidad] ?? entidad;
  return (
    <Modal open={open} onClose={onClose} maxW="md">
      <h2 className="font-playfair text-primary text-2xl font-semibold mb-4">
        {initial ? "Editar" : "Agregar"} {label}
      </h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Código</span>
          <input
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas"
          />
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Nombre</span>
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas"
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