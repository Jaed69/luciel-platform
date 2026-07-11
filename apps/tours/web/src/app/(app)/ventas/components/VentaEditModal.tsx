"use client";
import { useState, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { showToast } from "@/components/Toast";

type Venta = {
  id: number;
  tour_id: number;
  agencia_id: number;
  forma_pago_id: number;
  monto: number;
  costo: number | null;
};

type Catalogo = { id: number; nombre: string };

export function VentaEditModal({ venta, open, onClose, onSaved }: { venta: Venta | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [agencias, setAgencias] = useState<Catalogo[]>([]);
  const [formasPago, setFormasPago] = useState<Catalogo[]>([]);
  const [agenciaId, setAgenciaId] = useState("");
  const [formaPagoId, setFormaPagoId] = useState("");
  const [monto, setMonto] = useState("");
  const [costo, setCosto] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !venta) return;
    setAgenciaId(String(venta.agencia_id));
    setFormaPagoId(String(venta.forma_pago_id));
    setMonto(String(venta.monto));
    setCosto(venta.costo == null ? "" : String(venta.costo));
    Promise.all([
      fetch("/api/catalogos/agencias").then((r) => r.json()).catch(() => []),
      fetch("/api/catalogos/formas-pago").then((r) => r.json()).catch(() => []),
    ]).then(([a, fp]) => {
      setAgencias(a);
      setFormasPago(fp);
    });
  }, [open, venta]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!venta || submitting) return;
    setSubmitting(true);
    const res = await fetch(`/api/ventas/${venta.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agencia_id: parseInt(agenciaId),
        forma_pago_id: parseInt(formaPagoId),
        monto: parseFloat(monto),
        costo: costo === "" ? null : parseFloat(costo),
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      showToast("success", "Venta actualizada");
      onSaved();
      onClose();
    } else {
      try {
        const err = await res.json();
        const detail = err.detail;
        const msg = typeof detail === "string" ? detail : (detail?.message ?? "Error al guardar");
        showToast("error", msg);
      } catch {
        showToast("error", "Error al guardar");
      }
    }
  }

  if (!venta) return null;

  return (
    <Modal open={open} onClose={onClose} maxW="md">
      <h2 className="font-playfair text-primary text-2xl font-semibold mb-4">Editar venta #{venta.id}</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Agencia</span>
          <select required value={agenciaId} onChange={(e) => setAgenciaId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas">
            <option value="">Selecciona…</option>
            {agencias.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Forma de pago</span>
          <select required value={formaPagoId} onChange={(e) => setFormaPagoId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas">
            <option value="">Selecciona…</option>
            {formasPago.map((fp) => <option key={fp.id} value={fp.id}>{fp.nombre}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Monto</span>
          <input required type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas tabular-nums" />
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Costo proveedor</span>
          <input type="number" step="0.01" value={costo} onChange={(e) => setCosto(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas tabular-nums" />
        </label>
        <div className="flex gap-3 justify-end mt-2">
          <Button variant="outlined" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={submitting}>{submitting ? "Guardando..." : "Guardar"}</Button>
        </div>
      </form>
    </Modal>
  );
}
