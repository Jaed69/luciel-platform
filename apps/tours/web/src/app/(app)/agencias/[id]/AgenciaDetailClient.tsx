// apps/tours/web/src/app/(app)/agencias/[id]/AgenciaDetailClient.tsx
// D-30 — saldo pendiente + precios por tour + historial de pagos + registrar pago.
"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { DataTable, type Column } from "@/components/DataTable";
import { showToast } from "@/components/Toast";

type Agencia = { id: number; codigo?: string; nombre: string; activo: boolean };
type Tour = { id: number; nombre: string };
type AgenciaPrecio = { id: number; agencia_id: number; tour_id: number; precio: number; precio_usd: number | null; activo: boolean };
type AgenciaPago = { id: number; agencia_id: number; fecha: string; monto: number; moneda: string; metodo: string; referencia: string | null; nota: string | null };
type Saldo = { agencia_id: number; PEN: number; USD: number };

function RegistrarPagoModal({ agenciaId, onClose, onSaved }: { agenciaId: number; onClose: () => void; onSaved: () => void }) {
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState("PEN");
  const [metodo, setMetodo] = useState("deposito");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [referencia, setReferencia] = useState("");
  const [nota, setNota] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const res = await fetch("/api/agencia-pagos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agencia_id: agenciaId,
        fecha,
        monto: Number(monto),
        moneda,
        metodo,
        referencia: referencia || null,
        nota: nota || null,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      showToast("success", "Pago registrado");
      onSaved();
      onClose();
    } else {
      showToast("error", "Error al registrar el pago");
    }
  }

  return (
    <Modal open onClose={onClose} maxW="md">
      <h2 className="font-playfair text-primary text-2xl font-semibold mb-4">Registrar pago</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Monto</span>
          <input required type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" />
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Moneda</span>
          <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas">
            <option value="PEN">PEN (S/)</option>
            <option value="USD">USD ($)</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Método</span>
          <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas">
            <option value="deposito">Depósito</option>
            <option value="comprobante">Comprobante</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Fecha</span>
          <input required type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" />
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Referencia</span>
          <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="n° depósito / comprobante" className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" />
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Nota</span>
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" rows={2} />
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

function PrecioFormModal({
  agenciaId,
  tours,
  initial,
  onClose,
  onSaved,
}: {
  agenciaId: number;
  tours: Tour[];
  initial?: AgenciaPrecio | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tourId, setTourId] = useState(initial?.tour_id ? String(initial.tour_id) : "");
  const [precio, setPrecio] = useState(initial?.precio != null ? String(initial.precio) : "");
  const [precioUsd, setPrecioUsd] = useState(initial?.precio_usd != null ? String(initial.precio_usd) : "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const body = {
      agencia_id: agenciaId,
      tour_id: Number(tourId),
      precio: Number(precio),
      precio_usd: precioUsd ? Number(precioUsd) : null,
    };
    const url = initial ? `/api/agencia-precios/${initial.id}` : "/api/agencia-precios";
    const method = initial ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSubmitting(false);
    if (res.ok) {
      showToast("success", initial ? "Precio actualizado" : "Precio agregado");
      onSaved();
      onClose();
    } else {
      showToast("error", "Error al guardar");
    }
  }

  return (
    <Modal open onClose={onClose} maxW="sm">
      <h2 className="font-playfair text-primary text-2xl font-semibold mb-4">{initial ? "Editar precio" : "Nuevo precio"}</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Tour</span>
          <select required value={tourId} onChange={(e) => setTourId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas">
            <option value="">Selecciona…</option>
            {tours.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Precio (PEN)</span>
          <input required type="number" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" />
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Precio (USD)</span>
          <input type="number" step="0.01" value={precioUsd} onChange={(e) => setPrecioUsd(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" />
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

export function AgenciaDetailClient({
  agencia,
  tours,
  precios,
  pagos,
  saldo,
}: {
  agencia: Agencia;
  tours: Tour[];
  precios: AgenciaPrecio[];
  pagos: AgenciaPago[];
  saldo: Saldo;
}) {
  const [pagoModalOpen, setPagoModalOpen] = useState(false);
  const [precioModalOpen, setPrecioModalOpen] = useState(false);
  const [editPrecio, setEditPrecio] = useState<AgenciaPrecio | null>(null);

  const tourNombre = (id: number) => tours.find((t) => t.id === id)?.nombre ?? `T-${id}`;

  async function handleDeletePrecio(r: AgenciaPrecio) {
    if (!window.confirm(`¿Eliminar el precio de ${tourNombre(r.tour_id)}?`)) return;
    const res = await fetch(`/api/agencia-precios/${r.id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("success", "Precio eliminado");
      window.location.reload();
    } else {
      showToast("error", "Error al eliminar");
    }
  }

  const precioColumns: Column<AgenciaPrecio>[] = [
    { key: "tour", header: "Tour", render: (r) => tourNombre(r.tour_id) },
    { key: "precio", header: "Precio (PEN)", render: (r) => `${r.precio}` },
    { key: "precio_usd", header: "Precio (USD)", render: (r) => (r.precio_usd != null ? `${r.precio_usd}` : "—") },
    {
      key: "acciones",
      header: "Acciones",
      render: (r) => (
        <span className="flex gap-3">
          <button type="button" className="text-primary hover:underline" onClick={() => { setEditPrecio(r); setPrecioModalOpen(true); }}>
            Editar
          </button>
          <button type="button" className="text-chili-red hover:underline" onClick={() => handleDeletePrecio(r)}>
            Eliminar
          </button>
        </span>
      ),
    },
  ];

  const pagoColumns: Column<AgenciaPago>[] = [
    { key: "fecha", header: "Fecha", render: (r) => new Date(r.fecha).toLocaleDateString("es-PE") },
    { key: "monto", header: "Monto", render: (r) => `${r.monto} ${r.moneda}` },
    { key: "metodo", header: "Método", render: (r) => r.metodo },
    { key: "referencia", header: "Referencia", render: (r) => r.referencia ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-playfair text-primary text-[32px] font-semibold">{agencia.nombre}</h1>
        <p className="font-nunito text-text-espresso-soft mt-1">
          Saldo pendiente: <span className="tabular-nums font-semibold">S/ {saldo.PEN}</span> · <span className="tabular-nums font-semibold">$ {saldo.USD}</span>
        </p>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-playfair text-primary text-[20px] font-semibold">Precios por tour</h2>
          <Button variant="outlined" size="sm" onClick={() => { setEditPrecio(null); setPrecioModalOpen(true); }}>Agregar precio</Button>
        </div>
        <DataTable columns={precioColumns} data={precios} emptyState="Sin precios cargados para esta agencia." />
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-playfair text-primary text-[20px] font-semibold">Pagos registrados</h2>
          <Button variant="primary" size="sm" onClick={() => setPagoModalOpen(true)}>Registrar pago</Button>
        </div>
        <DataTable columns={pagoColumns} data={pagos} emptyState="Sin pagos registrados." />
      </section>

      {pagoModalOpen && (
        <RegistrarPagoModal agenciaId={agencia.id} onClose={() => setPagoModalOpen(false)} onSaved={() => window.location.reload()} />
      )}
      {precioModalOpen && (
        <PrecioFormModal
          agenciaId={agencia.id}
          tours={tours}
          initial={editPrecio}
          onClose={() => setPrecioModalOpen(false)}
          onSaved={() => window.location.reload()}
        />
      )}
    </div>
  );
}
