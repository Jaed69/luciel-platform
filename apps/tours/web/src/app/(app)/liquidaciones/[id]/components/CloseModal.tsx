// apps/tours/web/src/app/(app)/liquidaciones/[id]/components/CloseModal.tsx
// S4 — "Cerrar liquidación LIQ-AAAA-NNN" Playfair 24 + asientos preview + warn copy + button.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { errorMessage } from "@/lib/errors";

type Liquidacion = {
  id: number;
  codigo: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  estado: "abierta" | "cerrada" | "revertida";
};

export function CloseModal({
  liquidacion,
  tipoServicio = "tour",
  disabled = false,
}: {
  liquidacion: Liquidacion;
  tipoServicio?: "tour" | "traslado";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const codigo = liquidacion.codigo ?? `Liquidación #${liquidacion.id}`;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      // Route Handler, not the FastAPI URL directly: this runs in the browser,
      // where the api/ proxy is what attaches the bearer token.
      const res = await fetch(`/api/liquidaciones/${liquidacion.id}/close`, { method: "POST" });
      if (!res.ok) {
        setError(await errorMessage(res, "No se pudo cerrar la liquidación"));
        setSubmitting(false);
        return;
      }
      setOpen(false);
      setSubmitting(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)} disabled={disabled}>
        Cerrar liquidación
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} maxW="md">
        <h2 className="font-playfair text-primary text-[24px] font-semibold mb-3">Cerrar liquidación {codigo}</h2>
        <p className="text-[14px] font-nunito text-text-espresso-soft mb-4">
          {tipoServicio === "traslado"
            ? "Este cierre no genera asientos — cada traslado ya quedó contabilizado al momento de la venta (D-34, no comisionan). Cerrar la liquidación solo la marca como saldada, para llevar el seguimiento."
            : "El cierre generará asientos de comisión automáticamente: débito 501-COSTOS-COMISIONES + crédito 201-COMISIONES-POR-PAGAR por cada vendedor en el rango."}
        </p>
        <div className="bg-amber-warning/10 border border-amber-warning/40 rounded p-md mb-4 text-chili-red text-[13px] font-nunito">
          ⚠️ Esta acción no se puede deshacer directamente. Para ajustar, usa &quot;Reabrir&quot; (genera asientos de reversión).
        </div>
        {error && <div className="text-chili-red text-[13px] mb-3">{error}</div>}
        <div className="flex gap-3 justify-end">
          <Button variant="outlined" size="sm" onClick={() => setOpen(false)} disabled={submitting}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={submitting}>Confirmar cierre</Button>
        </div>
      </Modal>
    </>
  );
}