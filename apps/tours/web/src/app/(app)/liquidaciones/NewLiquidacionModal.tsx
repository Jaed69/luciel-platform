"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { showToast } from "@/components/Toast";

type Catalogo = { id: number; codigo?: string; nombre: string };

export function NewLiquidacionModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [fechaDesde, setFechaDesde] = useState(today);
  const [fechaHasta, setFechaHasta] = useState(today);
  const [vendedorId, setVendedorId] = useState("");
  const [agenciaId, setAgenciaId] = useState("");
  const [vendedores, setVendedores] = useState<Catalogo[]>([]);
  const [agencias, setAgencias] = useState<Catalogo[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/catalogos/vendedores").then((r) => r.json()).catch(() => []),
      fetch("/api/catalogos/agencias").then((r) => r.json()).catch(() => []),
    ]).then(([v, a]) => {
      setVendedores(v);
      setAgencias(a);
    });
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (fechaHasta < fechaDesde) {
      setError("fecha_hasta debe ser posterior a fecha_desde");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/liquidaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        vendedor_id: vendedorId ? parseInt(vendedorId) : null,
        agencia_id: agenciaId ? parseInt(agenciaId) : null,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      showToast("success", "Liquidación creada");
      onCreated();
      onClose();
    } else {
      try {
        const err = await res.json();
        const detail = err.detail;
        const msg = typeof detail === "string" ? detail : (detail?.message ?? "Error al crear");
        setError(msg);
      } catch {
        setError("Error al crear");
      }
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxW="md">
      <h2 className="font-playfair text-primary text-2xl font-semibold mb-4">Nueva liquidación</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Fecha desde</span>
          <input required type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" />
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Fecha hasta</span>
          <input required type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" />
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Vendedor (opcional — todas si vacío)</span>
          <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas">
            <option value="">Todos</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Agencia (opcional — todas si vacío)</span>
          <select value={agenciaId} onChange={(e) => setAgenciaId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas">
            <option value="">Todas</option>
            {agencias.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </label>
        {error && <p className="text-chili-red text-sm font-nunito">{error}</p>}
        <div className="flex gap-3 justify-end mt-2">
          <Button variant="outlined" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={submitting}>{submitting ? "Creando..." : "Crear liquidación"}</Button>
        </div>
      </form>
    </Modal>
  );
}
