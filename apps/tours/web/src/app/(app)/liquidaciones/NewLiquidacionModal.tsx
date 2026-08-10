"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { DataTable, type Column } from "@/components/DataTable";
import { showToast } from "@/components/Toast";
import { errorMessage } from "@/lib/errors";
import { formatCurrency } from "@/lib/format";

type Catalogo = { id: number; codigo?: string; nombre: string };

type Candidata = {
  id: number;
  tour_id: number;
  vendedor_id: number;
  agencia_id: number;
  moneda: "PEN" | "USD";
  monto: number;
  fecha: string;
  observaciones?: string | null;
  // D-36 — presentes sólo en candidatas de tipo traslado.
  destino?: string | null;
  nombre_huesped?: string | null;
};

// D-35 — la liquidación ya no se arma auto-asignando todo lo que cae en el
// rango: el usuario revisa el detalle del depósito y elige a mano qué ventas
// liquida. El rango de fechas sigue existiendo, pero como filtro para acotar
// la lista de candidatas, no como criterio de asignación.
// D-36 — mismo modal sirve para tours y traslados; tipoServicio decide el
// filtro y las columnas de la tabla de selección. El tipo de la liquidación
// creada lo infiere el backend de las ventas elegidas, no se manda acá.
export function NewLiquidacionModal({
  open,
  tipoServicio = "tour",
  onClose,
  onCreated,
}: {
  open: boolean;
  tipoServicio?: "tour" | "traslado";
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [step, setStep] = useState<1 | 2>(1);
  const [fechaDesde, setFechaDesde] = useState(today);
  const [fechaHasta, setFechaHasta] = useState(today);
  const [vendedorId, setVendedorId] = useState("");
  const [agenciaId, setAgenciaId] = useState("");
  const [vendedores, setVendedores] = useState<Catalogo[]>([]);
  const [agencias, setAgencias] = useState<Catalogo[]>([]);
  const [tours, setTours] = useState<Catalogo[]>([]);
  const [candidatas, setCandidatas] = useState<Candidata[]>([]);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [buscando, setBuscando] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSeleccion(new Set());
    setError(null);
    Promise.all([
      fetch("/api/catalogos/vendedores").then((r) => r.json()).catch(() => []),
      fetch("/api/catalogos/agencias").then((r) => r.json()).catch(() => []),
      fetch("/api/catalogos/tours").then((r) => r.json()).catch(() => []),
    ]).then(([v, a, t]) => {
      setVendedores(v);
      setAgencias(a);
      setTours(t);
    });
  }, [open]);

  async function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    if (buscando) return;
    setError(null);
    if (fechaHasta < fechaDesde) {
      setError("fecha_hasta debe ser posterior a fecha_desde");
      return;
    }
    setBuscando(true);
    const qs = new URLSearchParams({
      tipo_servicio: tipoServicio,
      solo_no_liquidadas: "true",
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
    });
    if (vendedorId) qs.set("vendedor_id", vendedorId);
    if (agenciaId) qs.set("agencia_id", agenciaId);
    const res = await fetch(`/api/ventas?${qs.toString()}`);
    setBuscando(false);
    if (!res.ok) {
      setError(await errorMessage(res, "Error al buscar ventas"));
      return;
    }
    const rows: Candidata[] = await res.json();
    setCandidatas(rows);
    setSeleccion(new Set());
    setStep(2);
  }

  function toggleFila(id: number) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodas() {
    setSeleccion((prev) => (prev.size === candidatas.length ? new Set() : new Set(candidatas.map((c) => c.id))));
  }

  async function handleCrear() {
    if (submitting || seleccion.size === 0) return;
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/liquidaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        vendedor_id: vendedorId ? parseInt(vendedorId) : null,
        agencia_id: agenciaId ? parseInt(agenciaId) : null,
        tour_servicio_ids: Array.from(seleccion),
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      showToast("success", "Liquidación creada");
      onCreated();
      onClose();
    } else {
      setError(await errorMessage(res, "Error al crear"));
    }
  }

  const tourNombre = (id: number) => tours.find((t) => t.id === id)?.nombre ?? `T-${id}`;
  const vendedorNombre = (id: number) => vendedores.find((v) => v.id === id)?.nombre ?? `V-${id}`;
  const agenciaNombre = (id: number) => agencias.find((a) => a.id === id)?.nombre ?? `AG-${id}`;

  const checkColumn: Column<Candidata> = {
    key: "check",
    header: "",
    render: (r) => (
      <input type="checkbox" checked={seleccion.has(r.id)} onChange={() => toggleFila(r.id)} className="h-4 w-4" />
    ),
  };
  const fechaColumn: Column<Candidata> = {
    key: "fecha",
    header: "Fecha",
    render: (r) => new Date(r.fecha).toLocaleDateString("es-PE"),
  };
  const vendedorColumn: Column<Candidata> = { key: "vendedor", header: "Vendedor", render: (r) => vendedorNombre(r.vendedor_id) };
  const montoColumn: Column<Candidata> = {
    key: "monto",
    header: "Monto",
    render: (r) => <span className="tabular-nums">{formatCurrency(r.monto, r.moneda)}</span>,
  };
  const notasColumn: Column<Candidata> = {
    key: "observaciones",
    header: "Notas",
    render: (r) => (r.observaciones ? <span className="text-text-espresso-soft">{r.observaciones}</span> : null),
  };

  const columns: Column<Candidata>[] =
    tipoServicio === "traslado"
      ? [
          checkColumn,
          fechaColumn,
          { key: "destino", header: "Destino", render: (r) => r.destino ?? "—" },
          { key: "huesped", header: "Huésped", render: (r) => r.nombre_huesped ?? "—" },
          vendedorColumn,
          { key: "agencia", header: "Proveedor", render: (r) => agenciaNombre(r.agencia_id) },
          montoColumn,
          notasColumn,
        ]
      : [
          checkColumn,
          fechaColumn,
          { key: "tour", header: "Tour", render: (r) => tourNombre(r.tour_id) },
          vendedorColumn,
          { key: "agencia", header: "Agencia", render: (r) => agenciaNombre(r.agencia_id) },
          montoColumn,
          notasColumn,
        ];

  return (
    <Modal open={open} onClose={onClose} maxW={step === 1 ? "md" : "xl"}>
      {step === 1 ? (
        <>
          <h2 className="font-playfair text-primary text-2xl font-semibold mb-4">
            {tipoServicio === "traslado" ? "Nueva liquidación de traslados" : "Nueva liquidación"}
          </h2>
          <form onSubmit={handleBuscar} className="grid grid-cols-1 gap-4">
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
              <Button variant="primary" type="submit" disabled={buscando}>{buscando ? "Buscando..." : "Buscar ventas"}</Button>
            </div>
          </form>
        </>
      ) : (
        <>
          <h2 className="font-playfair text-primary text-2xl font-semibold mb-1">
            {tipoServicio === "traslado" ? "Elegí qué traslados liquidar" : "Elegí qué ventas liquidar"}
          </h2>
          <p className="text-sm font-nunito text-text-espresso-soft mb-4">
            {new Date(fechaDesde).toLocaleDateString("es-PE")} → {new Date(fechaHasta).toLocaleDateString("es-PE")}
          </p>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-sm font-nunito">
              <input type="checkbox" checked={seleccion.size === candidatas.length && candidatas.length > 0} onChange={toggleTodas} className="h-4 w-4" />
              Seleccionar todas
            </label>
            <span className="text-sm font-nunito text-text-espresso-soft">{seleccion.size} seleccionada{seleccion.size === 1 ? "" : "s"}</span>
          </div>
          <DataTable
            columns={columns}
            data={candidatas}
            emptyState={tipoServicio === "traslado" ? "No hay traslados sin liquidar en este rango." : "No hay ventas sin liquidar en este rango."}
          />
          {error && <p className="text-chili-red text-sm font-nunito mt-3">{error}</p>}
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outlined" type="button" onClick={() => setStep(1)}>Volver</Button>
            <Button variant="primary" type="button" onClick={handleCrear} disabled={submitting || seleccion.size === 0}>
              {submitting ? "Creando..." : `Crear liquidación (${seleccion.size})`}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
