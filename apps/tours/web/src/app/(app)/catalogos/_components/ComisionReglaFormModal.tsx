"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { showToast } from "@/components/Toast";

type Regla = {
  id: number;
  vendedor_id: number | null;
  tour_id: number | null;
  porcentaje: number;
  descripcion: string | null;
};

type Catalogo = { id: number; codigo?: string; nombre: string };

export function ComisionReglaFormModal({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial: Regla | null; onSaved: () => void }) {
  const [vendedorId, setVendedorId] = useState("");
  const [tourId, setTourId] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [vendedores, setVendedores] = useState<Catalogo[]>([]);
  const [tours, setTours] = useState<Catalogo[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setVendedorId(initial?.vendedor_id != null ? String(initial.vendedor_id) : "");
    setTourId(initial?.tour_id != null ? String(initial.tour_id) : "");
    setPorcentaje(initial ? String(initial.porcentaje) : "");
    setDescripcion(initial?.descripcion ?? "");
    setError(null);
    Promise.all([
      fetch("/api/catalogos/vendedores").then((r) => r.json()).catch(() => []),
      fetch("/api/catalogos/tours").then((r) => r.json()).catch(() => []),
    ]).then(([v, t]) => {
      setVendedores(v);
      setTours(t);
    });
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const pct = parseFloat(porcentaje);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setError("Porcentaje debe estar entre 0 y 100");
      return;
    }
    setSubmitting(true);
    const body = {
      vendedor_id: vendedorId ? parseInt(vendedorId) : null,
      tour_id: tourId ? parseInt(tourId) : null,
      porcentaje: pct,
      descripcion: descripcion || null,
    };
    const url = initial ? `/api/comision-reglas/${initial.id}` : "/api/comision-reglas";
    const method = initial ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (res.ok) {
      showToast("success", initial ? "Regla actualizada" : "Regla creada");
      onSaved();
      onClose();
    } else {
      try {
        const err = await res.json();
        const msg = typeof err.detail === "string" ? err.detail : "Error al guardar";
        setError(msg);
      } catch {
        setError("Error al guardar");
      }
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxW="md">
      <h2 className="font-playfair text-primary text-2xl font-semibold mb-4">
        {initial ? "Editar regla" : "Nueva regla de comisión"}
      </h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Vendedor (opcional)</span>
          <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas">
            <option value="">Todos (global)</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Tour (opcional)</span>
          <select value={tourId} onChange={(e) => setTourId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas">
            <option value="">Todos (global)</option>
            {tours.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Porcentaje</span>
          <input required type="number" step="0.01" min="0" max="100" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas tabular-nums" />
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Descripción</span>
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" />
        </label>
        {error && <p className="text-chili-red text-sm font-nunito">{error}</p>}
        <div className="flex gap-3 justify-end mt-2">
          <Button variant="outlined" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={submitting}>{submitting ? "Guardando..." : "Guardar"}</Button>
        </div>
      </form>
    </Modal>
  );
}
