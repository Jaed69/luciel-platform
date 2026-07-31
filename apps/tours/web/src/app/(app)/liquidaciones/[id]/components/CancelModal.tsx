// apps/tours/web/src/app/(app)/liquidaciones/[id]/components/CancelModal.tsx
// Salida para una liquidación `abierta` creada por error o de prueba: libera sus
// tours y borra la fila. Sin esto quedaba atrapada — `Reabrir` sólo aplica a una
// liquidación `cerrada`, y cerrar exige que el pre-check pase.
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

export function CancelModal({ liquidacion }: { liquidacion: Liquidacion }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const codigo = liquidacion.codigo ?? `Liquidación #${liquidacion.id}`;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/liquidaciones/${liquidacion.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError(await errorMessage(res, "No se pudo anular la liquidación"));
        setSubmitting(false);
        return;
      }
      router.push("/liquidaciones");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button variant="outlined" size="md" className="border-chili-red text-chili-red" onClick={() => setOpen(true)}>
        Anular liquidación
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} maxW="md">
        <h2 className="font-playfair text-primary text-[24px] font-semibold mb-3">Anular {codigo}</h2>
        <p className="text-[14px] font-nunito text-text-espresso-soft mb-4">
          Una liquidación abierta todavía no generó asientos, así que anularla no mueve los libros: los tours vuelven a quedar
          <strong> sin liquidar</strong> (podrás editarlos o incluirlos en otra liquidación) y esta liquidación se elimina.
        </p>
        <div className="bg-amber-warning/10 border border-amber-warning/40 rounded p-md mb-4 text-chili-red text-[13px] font-nunito">
          ⚠️ La liquidación desaparece del listado. Si ya estaba cerrada, esta acción no aplica — usa &quot;Reabrir&quot;.
        </div>
        {error && <div className="text-chili-red text-[13px] mb-3">{error}</div>}
        <div className="flex gap-3 justify-end">
          <Button variant="outlined" size="sm" onClick={() => setOpen(false)} disabled={submitting}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Anulando…" : "Anular liquidación"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
