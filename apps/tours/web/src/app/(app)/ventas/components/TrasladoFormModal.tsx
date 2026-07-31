// apps/tours/web/src/app/(app)/ventas/components/TrasladoFormModal.tsx
// D-34 — alta de traslado. Comparte tabla y circuito contable con la venta de
// tour, pero pide los datos operativos del servicio (huésped, habitación, hora,
// destino) y lo presta un proveedor de transporte, no una agencia de tours.
//
// Dos fechas separadas y rotuladas: la del traslado (operativa) y la del cobro
// (contable, la que fecha el asiento). Arrancan iguales porque suelen serlo.
// El margen es nuestro — el hotel somos nosotros — así que se muestra como
// ganancia, no como deuda con nadie.
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { showToast } from "@/components/Toast";
import { errorMessage } from "@/lib/errors";
import { formatCurrency } from "@/lib/format";

type Catalogo = { id: number; nombre: string; tipo?: string | null };

const INPUT = "w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas";
const LABEL = "text-sm font-nunito text-text-espresso-soft";

export function TrasladoFormModal({ role, vendedorId: ownVendedorId }: { role?: string; vendedorId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [vendedores, setVendedores] = useState<Catalogo[]>([]);
  const [agencias, setAgencias] = useState<Catalogo[]>([]);
  const [formasPago, setFormasPago] = useState<Catalogo[]>([]);

  const [vendedorId, setVendedorId] = useState("");
  const [agenciaId, setAgenciaId] = useState("");
  const [formaPagoId, setFormaPagoId] = useState("");
  const [moneda, setMoneda] = useState("PEN");
  const [monto, setMonto] = useState("");
  const [costo, setCosto] = useState("");
  const hoy = new Date().toISOString().slice(0, 10);
  const [fechaServicio, setFechaServicio] = useState(hoy);
  const [fecha, setFecha] = useState(hoy);
  // Mientras no la toquen a mano, la fecha de cobro sigue a la del traslado:
  // lo normal es que coincidan y no queremos hacer tipear dos veces lo mismo.
  const [fechaCobroEditada, setFechaCobroEditada] = useState(false);
  const [hora, setHora] = useState("");
  const [destino, setDestino] = useState("");
  const [nombreHuesped, setNombreHuesped] = useState("");
  const [numeroHabitacion, setNumeroHabitacion] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // D-32/D-34 — el vendedor se resuelve solo con quien está logueado; sólo cae
  // al selector si la cuenta no tiene un vendedor vinculado (p. ej. un admin).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open && ownVendedorId) setVendedorId(ownVendedorId);
  }

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/catalogos/vendedores").then((r) => r.json()).catch(() => []),
      fetch("/api/catalogos/agencias").then((r) => r.json()).catch(() => []),
      fetch("/api/catalogos/formas-pago").then((r) => r.json()).catch(() => []),
    ]).then(([v, a, fp]) => {
      setVendedores(v);
      setAgencias(a);
      setFormasPago(fp);
      // Efectivo por defecto: es como se cobra la enorme mayoría de traslados.
      const efectivo = (fp as Catalogo[]).find((f) => /efectivo/i.test(f.nombre));
      if (efectivo) setFormaPagoId((prev) => prev || String(efectivo.id));
    });
  }, [open]);

  // Las dos listas no se mezclan: un traslado sólo lo presta un transportista.
  const transportistas = agencias.filter((a) => a.tipo === "proveedor_transporte");
  const autoVendedor = Boolean(ownVendedorId);

  const montoNum = parseFloat(monto);
  const costoNum = costo === "" ? 0 : parseFloat(costo);
  const ganancia =
    Number.isFinite(montoNum) && Number.isFinite(costoNum) && montoNum > costoNum ? montoNum - costoNum : 0;
  const costoExcedido = Number.isFinite(montoNum) && Number.isFinite(costoNum) && costoNum > montoNum;

  function reset() {
    setMonto("");
    setCosto("");
    setHora("");
    setFechaCobroEditada(false);
    setDestino("");
    setNombreHuesped("");
    setNumeroHabitacion("");
    setObservaciones("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || costoExcedido) return;
    setSubmitting(true);
    const res = await fetch("/api/traslados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendedor_id: parseInt(vendedorId),
        agencia_id: parseInt(agenciaId),
        forma_pago_id: parseInt(formaPagoId),
        moneda,
        monto: montoNum,
        costo: costo === "" ? 0 : costoNum,
        fecha,
        fecha_servicio: fechaServicio,
        hora,
        destino,
        nombre_huesped: nombreHuesped,
        numero_habitacion: numeroHabitacion,
        observaciones: observaciones || null,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      showToast("success", "Traslado registrado");
      reset();
      setOpen(false);
      router.refresh();
    } else {
      showToast("error", await errorMessage(res, "Error al registrar el traslado"));
    }
  }

  return (
    <>
      <Button variant="outlined" onClick={() => setOpen(true)}>Registrar traslado</Button>
      <Modal open={open} onClose={() => setOpen(false)} maxW="lg">
        <h2 className="font-playfair text-primary text-2xl font-semibold mb-4">Registrar traslado</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className={LABEL}>Fecha del traslado</span>
            <input
              required type="date" value={fechaServicio}
              onChange={(e) => {
                setFechaServicio(e.target.value);
                if (!fechaCobroEditada) setFecha(e.target.value);
              }}
              className={INPUT}
            />
            <span className="text-[12px] text-text-espresso-soft font-nunito">Cuándo se hace el servicio</span>
          </label>
          <label className="block">
            <span className={LABEL}>Hora del traslado</span>
            <input required type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={INPUT} />
          </label>

          <label className="block md:col-span-2">
            <span className={LABEL}>Fecha de cobro</span>
            <input
              required type="date" value={fecha}
              onChange={(e) => {
                setFecha(e.target.value);
                setFechaCobroEditada(true);
              }}
              className={INPUT}
            />
            <span className="text-[12px] text-text-espresso-soft font-nunito">
              Cuándo nos pagan — es la fecha con la que entra a la contabilidad.
              {!fechaCobroEditada && " Sigue a la del traslado hasta que la cambies."}
            </span>
          </label>

          <label className="block">
            <span className={LABEL}>Nombre del huésped</span>
            <input required value={nombreHuesped} onChange={(e) => setNombreHuesped(e.target.value)} className={INPUT} />
          </label>
          <label className="block">
            <span className={LABEL}>N.º de habitación</span>
            <input required value={numeroHabitacion} onChange={(e) => setNumeroHabitacion(e.target.value)} className={INPUT} />
          </label>

          <label className="block md:col-span-2">
            <span className={LABEL}>Destino</span>
            <input
              required
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="Aeropuerto, estación de tren…"
              className={INPUT}
            />
          </label>

          <label className="block">
            <span className={LABEL}>Proveedor del transporte</span>
            <select required value={agenciaId} onChange={(e) => setAgenciaId(e.target.value)} className={INPUT}>
              <option value="">Selecciona…</option>
              {transportistas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
            {transportistas.length === 0 && (
              <span className="text-[12px] text-chili-red font-nunito">
                No hay proveedores de transporte cargados. Creá uno en Catálogos → Agencias con tipo “proveedor de transporte”.
              </span>
            )}
          </label>

          {autoVendedor ? (
            <div className="block">
              <span className={LABEL}>Vendedor</span>
              <p className="px-3 py-2 text-[15px] font-nunito">
                {vendedores.find((v) => String(v.id) === ownVendedorId)?.nombre ?? "Tú"}
              </p>
            </div>
          ) : (
            <label className="block">
              <span className={LABEL}>Vendedor</span>
              <select required value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} className={INPUT}>
                <option value="">Selecciona…</option>
                {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </label>
          )}
          <label className="block">
            <span className={LABEL}>Método de pago</span>
            <select required value={formaPagoId} onChange={(e) => setFormaPagoId(e.target.value)} className={INPUT}>
              <option value="">Selecciona…</option>
              {formasPago.map((fp) => <option key={fp.id} value={fp.id}>{fp.nombre}</option>)}
            </select>
          </label>

          <label className="block">
            <span className={LABEL}>Moneda</span>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className={INPUT}>
              <option value="PEN">PEN</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="block">
            <span className={LABEL}>Precio cobrado al huésped</span>
            <input
              required type="number" step="0.01" min="0.01"
              value={monto} onChange={(e) => setMonto(e.target.value)}
              className={`${INPUT} tabular-nums`}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Costo del proveedor</span>
            <input
              type="number" step="0.01" min="0"
              value={costo} onChange={(e) => setCosto(e.target.value)}
              className={`${INPUT} tabular-nums`}
            />
          </label>

          <div className="md:col-span-2 bg-stone-wall/40 border border-gold/30 rounded p-3 text-[13px] font-nunito">
            {costoExcedido ? (
              <span className="text-chili-red">
                El costo del proveedor no puede superar el precio cobrado al huésped.
              </span>
            ) : (
              <>
                <span className="text-text-espresso-soft">Ganancia (precio − costo): </span>
                <strong className="tabular-nums">
                  {formatCurrency(ganancia, moneda as "PEN" | "USD")}
                </strong>
                <span className="text-text-espresso-soft"> — queda para la casa.</span>
              </>
            )}
          </div>

          <label className="block md:col-span-2">
            <span className={LABEL}>Notas y observaciones</span>
            <textarea rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className={INPUT} />
          </label>

          <div className="md:col-span-2 flex gap-3 justify-end mt-2">
            <Button variant="outlined" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" disabled={submitting || costoExcedido}>
              {submitting ? "Guardando..." : "Guardar traslado"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
