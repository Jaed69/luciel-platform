"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { showToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";

type Catalogo = { id: number; codigo?: string; nombre: string };
type AgenciaPrecio = { agencia_id: number; tour_id: number; precio: number | null; precio_usd: number | null };

export function VentaFormModal() {
  const [open, setOpen] = useState(false);
  const [tours, setTours] = useState<Catalogo[]>([]);
  const [vendedores, setVendedores] = useState<Catalogo[]>([]);
  const [agencias, setAgencias] = useState<Catalogo[]>([]);
  const [formasPago, setFormasPago] = useState<Catalogo[]>([]);
  const [agenciaPrecios, setAgenciaPrecios] = useState<AgenciaPrecio[]>([]);

  const [tourId, setTourId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [agenciaId, setAgenciaId] = useState("");
  const [formaPagoId, setFormaPagoId] = useState("");
  const [moneda, setMoneda] = useState("PEN");
  const [monto, setMonto] = useState("");
  const [costo, setCosto] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState("");
  const [preview, setPreview] = useState<{ porcentaje: number; comision: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  // Load catálogos when modal opens
  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/catalogos/tours").then((r) => r.json()).catch(() => []),
      fetch("/api/catalogos/vendedores").then((r) => r.json()).catch(() => []),
      fetch("/api/catalogos/agencias").then((r) => r.json()).catch(() => []),
      fetch("/api/catalogos/formas-pago").then((r) => r.json()).catch(() => []),
      fetch("/api/agencia-precios").then((r) => r.json()).catch(() => []),
    ]).then(([t, v, a, fp, precios]) => {
      setTours(t);
      setVendedores(v);
      setAgencias(a);
      setFormasPago(fp);
      setAgenciaPrecios(precios);
    });
  }, [open]);

  // D-30 — autocompleta costo (deuda a la agencia) desde el precio de lista
  // agencia×tour; queda editable si el usuario quiere ajustarlo.
  useEffect(() => {
    if (!agenciaId || !tourId) return;
    const match = agenciaPrecios.find((p) => p.agencia_id === Number(agenciaId) && p.tour_id === Number(tourId));
    if (!match) return;
    const precio = moneda === "USD" ? match.precio_usd : match.precio;
    if (precio != null) setCosto(String(precio));
  }, [agenciaId, tourId, moneda, agenciaPrecios]);

  // Live comisión preview — debounced 300ms
  useEffect(() => {
    if (!tourId || !vendedorId || !monto) {
      setPreview(null);
      setPreviewError(false);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(false);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/simular?vendedor_id=${vendedorId}&tour_id=${tourId}&monto=${monto}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setPreview({ porcentaje: data.porcentaje, comision: data.comision });
      } catch {
        setPreviewError(true);
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [tourId, vendedorId, monto]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/ventas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tour_id: parseInt(tourId),
        vendedor_id: parseInt(vendedorId),
        agencia_id: parseInt(agenciaId),
        forma_pago_id: parseInt(formaPagoId),
        moneda,
        monto: parseFloat(monto),
        costo: costo ? parseFloat(costo) : 0,
        fecha,
        metadata: notas ? { notas } : null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      showToast("success", `Venta registrada. Asiento ${data.asiento_id} cuadrado.`);
      setOpen(false);
      window.location.reload();
    } else {
      showToast("error", "Error al registrar la venta. Revisa los datos.");
    }
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>Registrar venta</Button>
      <Modal open={open} onClose={() => setOpen(false)} maxW="lg">
        <h2 className="font-playfair text-primary text-2xl font-semibold mb-4">Registrar venta</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <label className="block">
            <span className="text-sm font-nunito text-text-espresso-soft">Tour</span>
            <select required value={tourId} onChange={(e) => setTourId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas">
              <option value="">Selecciona…</option>
              {tours.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-nunito text-text-espresso-soft">Vendedor</span>
            <select required value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas">
              <option value="">Selecciona…</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
          </label>
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
            <span className="text-sm font-nunito text-text-espresso-soft">Moneda</span>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas">
              <option value="PEN">PEN (S/)</option>
              <option value="USD">USD ($)</option>
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
          <label className="block">
            <span className="text-sm font-nunito text-text-espresso-soft">Fecha</span>
            <input required type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" />
          </label>
          <label className="block lg:col-span-2">
            <span className="text-sm font-nunito text-text-espresso-soft">Notas internas</span>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" rows={2} />
          </label>

          {/* Live comisión preview */}
          <div className="lg:col-span-2">
            <p className="text-sm font-nunito font-semibold text-text-espresso-soft mb-1">Comisión estimada</p>
            {previewLoading ? (
              <Skeleton rows={1} />
            ) : preview ? (
              <p className="font-nunito text-text-espresso tabular-nums">
                S/ {preview.comision.toFixed(2)} ({preview.porcentaje}%)
              </p>
            ) : previewError ? (
              <p className="font-nunito text-chili-red text-sm">
                No se pudo resolver una regla de comisión. Configura una regla en &quot;Catálogos → Comisiones&quot; o usa la regla global por defecto.
              </p>
            ) : (
              <p className="font-nunito text-text-espresso-soft text-sm">
                Completa tour, vendedor y monto para previsualizar la comisión.
              </p>
            )}
          </div>

          <div className="lg:col-span-2 flex gap-6 justify-end">
            <Button variant="outlined" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit">Registrar venta</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}