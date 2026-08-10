// apps/tours/web/src/app/(app)/liquidaciones/[id]/components/ReopenModal.tsx
// S4 — "Reabrir LIQ-AAAA-NNN" Playfair 24 + D-13 copy + button.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { errorMessage } from "@/lib/errors";

type Liquidacion = {
  id: number;
  codigo: string | null;
  estado: "abierta" | "cerrada" | "revertida";
};

export function ReopenModal({
  liquidacion,
  tipoServicio = "tour",
}: {
  liquidacion: Liquidacion;
  tipoServicio?: "tour" | "traslado";
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
      const res = await fetch(`/api/liquidaciones/${liquidacion.id}/reopen`, { method: "POST" });
      if (!res.ok) {
        setError(await errorMessage(res, "No se pudo reabrir la liquidación"));
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
      <Button variant="outlined" size="md" className="border-gold bg-gold/5" onClick={() => setOpen(true)}>
        Reabrir liquidación
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} maxW="md">
        <h2 className="font-playfair text-primary text-[24px] font-semibold mb-3">Reabrir {codigo}</h2>
        <p className="text-[14px] font-nunito text-text-espresso-soft mb-4">
          {tipoServicio === "traslado" ? (
            <>
              Reabrir libera los traslados para que puedan incluirse en otra liquidación. No hay asientos que revertir,
              porque el cierre no generó ninguno — la liquidación original queda con estado <strong>revertida</strong> igual, para auditoría.
            </>
          ) : (
            <>
              Reabrir genera asientos de reversión que cancelan el cierre original. La liquidación original queda con estado <strong>revertida</strong>,
              los tours se desbloquean (pueden editarse nuevamente) y se conservan todos los asientos para auditoría.
            </>
          )}
        </p>
        <div className="bg-stone-wall/40 border border-wine-muted/30 rounded p-md mb-4 text-text-espresso-soft text-[13px] font-nunito">
          ⓘ Una nueva liquidación sobre el mismo rango recibirá un código incremental (LIQ-AAAA-002 si la original fue LIQ-AAAA-001).
        </div>
        {error && <div className="text-chili-red text-[13px] mb-3">{error}</div>}
        <div className="flex gap-3 justify-end">
          <Button variant="outlined" size="sm" onClick={() => setOpen(false)} disabled={submitting}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={submitting}>Reabrir liquidación</Button>
        </div>
      </Modal>
    </>
  );
}