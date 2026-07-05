// apps/tours/web/src/components/comisiones/ComisionReglaModal.tsx
// S5 — Admin modal for crear/editar regla with optional vendedor + tour + porcentaje + precedencia slot preview.
"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";

type Props = {
  open: boolean;
  onClose: () => void;
  vendedores: { id: number; nombre: string }[];
  tours: { id: number; nombre: string }[];
};

export function ComisionReglaModal({ open, onClose, vendedores, tours }: Props) {
  const [vendedorId, setVendedorId] = useState<number | null>(null);
  const [tourId, setTourId] = useState<number | null>(null);
  const [porcentaje, setPorcentaje] = useState<number | "">("");

  const previewSlot =
    vendedorId != null && tourId != null
      ? `Esta regla se aplicará cuando vendedor=V-${vendedorId} y tour=T-${tourId}`
      : vendedorId != null
      ? `Esta regla se aplicará para vendedor V-${vendedorId} (todos los tours)`
      : tourId != null
      ? `Esta regla se aplicará para tour T-${tourId} (todos los vendedores)`
      : "Esta regla se aplicará por defecto (global)";

  return (
    <Modal open={open} onClose={onClose} maxW="md">
      <h2 className="font-playfair text-primary text-[24px] font-semibold mb-3">Nueva regla de comisión</h2>
      <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
        <div className="flex flex-col">
          <label className="text-sm font-nunito font-semibold text-text-espresso-soft mb-1" htmlFor="cr_vendedor">Vendedor (opcional)</label>
          <select
            id="cr_vendedor"
            value={vendedorId ?? ""}
            onChange={(e) => setVendedorId(e.target.value ? Number(e.target.value) : null)}
            className="border border-gold/40 rounded px-2 py-1.5 text-sm font-nunito"
          >
            <option value="">sin asignar (default global)</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-sm font-nunito font-semibold text-text-espresso-soft mb-1" htmlFor="cr_tour">Tour (opcional)</label>
          <select
            id="cr_tour"
            value={tourId ?? ""}
            onChange={(e) => setTourId(e.target.value ? Number(e.target.value) : null)}
            className="border border-gold/40 rounded px-2 py-1.5 text-sm font-nunito"
          >
            <option value="">sin asignar (default global)</option>
            {tours.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-sm font-nunito font-semibold text-text-espresso-soft mb-1" htmlFor="cr_pct">Porcentaje</label>
          <input
            id="cr_pct"
            type="number"
            step="0.5"
            min="0"
            max="100"
            value={porcentaje}
            onChange={(e) => setPorcentaje(e.target.value === "" ? "" : Number(e.target.value))}
            className="border border-gold/40 rounded px-2 py-1.5 text-sm font-nunito"
          />
        </div>
        <p className="text-[13px] font-nunito text-text-espresso-soft bg-gold-lightest/40 border border-gold/30 rounded p-2">
          {previewSlot}
        </p>
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="outlined" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" type="submit">Guardar</Button>
        </div>
      </form>
    </Modal>
  );
}