"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { showToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";
import { TourAgenciaSearch, type TourSearchRow } from "./TourAgenciaSearch";

type Catalogo = { id: number; codigo?: string; nombre: string };
type AgenciaPrecio = { agencia_id: number; tour_id: number; precio: number | null; precio_usd: number | null };
type Motivo = "convenio_desactualizado" | "descuento_especial" | "error_de_carga" | "otro";

const MOTIVO_LABELS: Record<Motivo, string> = {
  convenio_desactualizado: "Convenio desactualizado",
  descuento_especial: "Descuento especial",
  error_de_carga: "Error de carga",
  otro: "Otro",
};

function fmtNum(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function VentaFormModal({ role, vendedorId: ownVendedorId }: { role?: string; vendedorId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [vendedores, setVendedores] = useState<Catalogo[]>([]);
  const [agencias, setAgencias] = useState<Catalogo[]>([]);
  const [formasPago, setFormasPago] = useState<Catalogo[]>([]);
  const [agenciaPrecios, setAgenciaPrecios] = useState<AgenciaPrecio[]>([]);

  const [tourId, setTourId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [agenciaId, setAgenciaId] = useState("");
  const [alternateAgencias, setAlternateAgencias] = useState<{ id: number; nombre: string }[]>([]);
  const [formaPagoId, setFormaPagoId] = useState("");
  const [moneda, setMoneda] = useState("PEN");
  const [monto, setMonto] = useState("");
  const [costo, setCosto] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState("");
  const [preview, setPreview] = useState<{ porcentaje: number; comision: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  // D-33 — auto-resolved baselines (from tour-search precio) vs. manual edits.
  const [costoAuto, setCostoAuto] = useState<number | null>(null);
  const [montoAuto, setMontoAuto] = useState<number | null>(null);
  const [costoEditing, setCostoEditing] = useState(false);
  const [montoEditing, setMontoEditing] = useState(false);
  const [motivoCosto, setMotivoCosto] = useState<Motivo | "">("");
  const [motivoMonto, setMotivoMonto] = useState<Motivo | "">("");

  const [duplicadoWarning, setDuplicadoWarning] = useState<{ createAnother: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const tourSearchRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const defaultsAppliedRef = useRef(false);

  // Load catálogos when modal opens
  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/catalogos/vendedores").then((r) => r.json()).catch(() => []),
      fetch("/api/catalogos/agencias").then((r) => r.json()).catch(() => []),
      fetch("/api/catalogos/formas-pago").then((r) => r.json()).catch(() => []),
      fetch("/api/agencia-precios").then((r) => r.json()).catch(() => []),
    ]).then(([v, a, fp, precios]) => {
      setVendedores(v);
      setAgencias(a);
      setFormasPago(fp);
      setAgenciaPrecios(precios);
    });
    // D-32 — un vendedor siempre registra a su propio nombre; se autocompleta
    // sin esperar selección manual.
    if (role === "vendedor" && ownVendedorId) setVendedorId(ownVendedorId);

    // D-33 — remember last forma_pago/moneda from the most recent venta.
    if (!defaultsAppliedRef.current) {
      defaultsAppliedRef.current = true;
      const params = new URLSearchParams();
      if (role === "vendedor" && ownVendedorId) params.set("vendedor_id", ownVendedorId);
      fetch(`/api/ventas?${params}`)
        .then((r) => r.json())
        .then((rows) => {
          const last = Array.isArray(rows) ? rows[0] : null;
          if (!last) return;
          setFormaPagoId((prev) => (prev ? prev : String(last.forma_pago_id)));
          setMoneda((prev) => (prev ? prev : last.moneda));
        })
        .catch(() => {});
    }
  }, [open, role, ownVendedorId]);

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

  function resetForm() {
    setTourId("");
    setAgenciaId("");
    setAlternateAgencias([]);
    setMonto("");
    setCosto("");
    setCostoAuto(null);
    setMontoAuto(null);
    setCostoEditing(false);
    setMontoEditing(false);
    setMotivoCosto("");
    setMotivoMonto("");
    setNotas("");
    setFecha(new Date().toISOString().slice(0, 10));
    setDuplicadoWarning(null);
  }

  function handleTourSelect(row: TourSearchRow) {
    setTourId(String(row.tour_id));
    const precio = moneda === "USD" ? row.precio_usd : row.precio;
    if (row.agencia_id != null) {
      setAgenciaId(String(row.agencia_id));
    }
    if (precio != null) {
      setCostoAuto(precio);
      setMontoAuto(precio);
      setCosto(fmtNum(precio));
      setMonto(fmtNum(precio));
    }
    setCostoEditing(false);
    setMontoEditing(false);
    setMotivoCosto("");
    setMotivoMonto("");

    // Alternate agencias — if this tour has 2+ active price agreements, offer
    // an editable dropdown defaulting to the search-resolved agencia.
    const matches = agenciaPrecios.filter((p) => p.tour_id === row.tour_id);
    const ids = Array.from(new Set(matches.map((p) => p.agencia_id)));
    if (ids.length >= 2) {
      setAlternateAgencias(ids.map((id) => ({ id, nombre: agencias.find((a) => a.id === id)?.nombre ?? `Agencia ${id}` })));
    } else {
      setAlternateAgencias([]);
    }
  }

  async function doSubmit(createAnother: boolean, skipDupeCheck = false) {
    if (submitting) return;
    if (!tourId || !agenciaId) {
      showToast("error", "Selecciona un tour de la búsqueda.");
      return;
    }
    if (!vendedorId || !formaPagoId || !monto || !fecha) {
      showToast("error", "Completa los campos requeridos.");
      return;
    }
    // D-33 — motivo is required whenever the value actually diverges from
    // the auto-resolved price, regardless of whether the pencil toggle is
    // still open (closing it after editing must not silently drop the
    // requirement — see review finding on the toggle-then-submit bypass).
    if (costoDirty && !motivoCosto) {
      showToast("error", "Indica un motivo para el cambio de costo.");
      return;
    }
    if (montoDirty && !motivoMonto) {
      showToast("error", "Indica un motivo para el cambio de monto.");
      return;
    }

    if (!skipDupeCheck) {
      try {
        const params = new URLSearchParams({
          tour_id: tourId,
          agencia_id: agenciaId,
          monto,
          fecha,
        });
        const res = await fetch(`/api/ventas/check-duplicado?${params}`);
        if (res.ok) {
          const data = await res.json();
          if (data.duplicado) {
            setDuplicadoWarning({ createAnother });
            return;
          }
        }
      } catch {
        // network hiccup on the check shouldn't block registering the venta
      }
    }
    setDuplicadoWarning(null);
    setSubmitting(true);

    const body: Record<string, unknown> = {
      tour_id: parseInt(tourId),
      vendedor_id: parseInt(vendedorId),
      agencia_id: parseInt(agenciaId),
      forma_pago_id: parseInt(formaPagoId),
      moneda,
      monto: parseFloat(monto),
      costo: costo ? parseFloat(costo) : 0,
      fecha,
      metadata: notas ? { notas } : null,
    };
    if (costoDirty && motivoCosto) body.motivo_costo = motivoCosto;
    if (montoDirty && motivoMonto) body.motivo_monto = motivoMonto;

    const res = await fetch("/api/ventas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      const ventaId = data.tour_servicio_id;
      showToast("success", `Venta registrada. Asiento ${data.asiento_id} cuadrado.`, {
        actionLabel: "Deshacer",
        durationMs: 8000,
        onAction: async () => {
          const undoRes = await fetch(`/api/ventas/${ventaId}/undo`, { method: "DELETE" });
          if (undoRes.ok) {
            showToast("success", "Venta deshecha.");
            router.refresh();
          } else {
            showToast("error", "No se pudo deshacer la venta.");
          }
        },
      });
      if (createAnother) {
        resetForm();
        router.refresh();
        tourSearchRef.current?.focus();
      } else {
        setOpen(false);
        router.refresh();
      }
    } else {
      showToast("error", "Error al registrar la venta. Revisa los datos.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await doSubmit(false);
  }

  async function handleSubmitAndCreateAnother() {
    await doSubmit(true);
  }

  // D-33 — dirty is a pure value comparison against the auto-resolved
  // baseline, independent of the pencil edit-mode toggle: an emptied field
  // must still count as dirty (parseFloat("") -> NaN -> "0" fallback -> 0,
  // which differs from any real auto price), and closing the pencil after
  // editing must not make a real change look clean again.
  const costoDirty = costoAuto != null && parseFloat(costo || "0") !== costoAuto;
  const montoDirty = montoAuto != null && parseFloat(monto || "0") !== montoAuto;

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>Registrar venta</Button>
      <Modal open={open} onClose={() => setOpen(false)} maxW="lg">
        <h2 className="font-playfair text-primary text-2xl font-semibold mb-4">Registrar venta</h2>
        <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <label className="block lg:col-span-2">
            <span className="text-sm font-nunito text-text-espresso-soft">Tour</span>
            <TourAgenciaSearch
              ref={tourSearchRef}
              vendedorId={vendedorId || undefined}
              onSelect={handleTourSelect}
              tabIndex={1}
              onEnterSubmit={() => formRef.current?.requestSubmit()}
            />
          </label>

          {alternateAgencias.length >= 2 && (
            <label className="block">
              <span className="text-sm font-nunito text-text-espresso-soft">Agencia</span>
              <select required value={agenciaId} onChange={(e) => setAgenciaId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas">
                {alternateAgencias.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </label>
          )}

          <label className="block">
            <span className="text-sm font-nunito text-text-espresso-soft">Vendedor</span>
            {role === "vendedor" && ownVendedorId ? (
              <p className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas tabular-nums">
                {vendedores.find((v) => String(v.id) === ownVendedorId)?.nombre ?? "Tú"}
              </p>
            ) : (
              <select required value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas">
                <option value="">Selecciona…</option>
                {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-nunito text-text-espresso-soft">Forma de pago</span>
            <select required tabIndex={2} value={formaPagoId} onChange={(e) => setFormaPagoId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas">
              <option value="">Selecciona…</option>
              {formasPago.map((fp) => <option key={fp.id} value={fp.id}>{fp.nombre}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-nunito text-text-espresso-soft">Moneda</span>
            <select tabIndex={3} value={moneda} onChange={(e) => setMoneda(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas">
              <option value="PEN">PEN (S/)</option>
              <option value="USD">USD ($)</option>
            </select>
          </label>

          {/* D-33 — monto: read-only display resolved from tour-search precio; pencil toggles into edit + requires motivo when changed. */}
          <label className="block">
            <span className="text-sm font-nunito text-text-espresso-soft">Monto</span>
            <div className="flex items-center gap-2">
              {montoEditing ? (
                <input
                  aria-label="Monto"
                  required
                  type="number"
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas tabular-nums"
                />
              ) : (
                <p aria-label="Monto" className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas tabular-nums">{monto || "—"}</p>
              )}
              <button type="button" aria-label="Editar monto" onClick={() => setMontoEditing((v) => !v)} className="shrink-0 text-primary">✎</button>
            </div>
            {montoDirty && (
              <select
                aria-label="Motivo del cambio de monto"
                value={motivoMonto}
                onChange={(e) => setMotivoMonto(e.target.value as Motivo)}
                className="w-full mt-2 px-3 py-2 rounded-lg border border-gold/30 bg-canvas"
              >
                <option value="">Motivo del cambio…</option>
                {(Object.keys(MOTIVO_LABELS) as Motivo[]).map((m) => <option key={m} value={m}>{MOTIVO_LABELS[m]}</option>)}
              </select>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-nunito text-text-espresso-soft">Costo proveedor</span>
            <div className="flex items-center gap-2">
              {costoEditing ? (
                <input
                  aria-label="Costo proveedor"
                  type="number"
                  step="0.01"
                  value={costo}
                  onChange={(e) => setCosto(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas tabular-nums"
                />
              ) : (
                <p aria-label="Costo proveedor" className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas tabular-nums">{costo || "—"}</p>
              )}
              <button type="button" aria-label="Editar costo proveedor" onClick={() => setCostoEditing((v) => !v)} className="shrink-0 text-primary">✎</button>
            </div>
            {costoDirty && (
              <select
                aria-label="Motivo del cambio de costo"
                value={motivoCosto}
                onChange={(e) => setMotivoCosto(e.target.value as Motivo)}
                className="w-full mt-2 px-3 py-2 rounded-lg border border-gold/30 bg-canvas"
              >
                <option value="">Motivo del cambio…</option>
                {(Object.keys(MOTIVO_LABELS) as Motivo[]).map((m) => <option key={m} value={m}>{MOTIVO_LABELS[m]}</option>)}
              </select>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-nunito text-text-espresso-soft">Fecha</span>
            <input required tabIndex={4} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" />
          </label>
          <label className="block lg:col-span-2">
            <span className="text-sm font-nunito text-text-espresso-soft">Notas internas</span>
            <textarea tabIndex={5} value={notas} onChange={(e) => setNotas(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas" rows={2} />
          </label>

          {duplicadoWarning && (
            <div className="lg:col-span-2 rounded-lg border border-amber-warning bg-amber-warning/10 p-3 flex items-center justify-between gap-4">
              <p className="font-nunito text-sm text-text-espresso">
                Ya existe una venta con el mismo tour, agencia, monto y fecha. ¿Es un registro duplicado?
              </p>
              <Button variant="outlined" size="sm" type="button" onClick={() => doSubmit(duplicadoWarning.createAnother, true)}>
                Continuar de todas formas
              </Button>
            </div>
          )}

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
            <Button variant="outlined" type="button" onClick={handleSubmitAndCreateAnother} disabled={submitting}>Registrar y crear otra</Button>
            <Button variant="primary" type="submit" disabled={submitting}>Registrar venta</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
