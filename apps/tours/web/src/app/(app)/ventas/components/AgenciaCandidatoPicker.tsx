"use client";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";

export type AgenciaCandidato = {
  agencia_id: number;
  agencia_nombre: string | null;
  precio: number | null;
  precio_usd: number | null;
  moneda: "PEN" | "USD";
};

function formatMonto(candidato: AgenciaCandidato): string {
  const value = candidato.moneda === "USD" ? candidato.precio_usd : candidato.precio;
  if (value == null) return "—";
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: candidato.moneda }).format(value);
}

// D-33 follow-up — when tour-search can't resolve a single agencia (e.g. two
// agencias quoting the same tour in different currencies), the backend
// returns unresolved `candidatos` instead of guessing. This picker forces an
// explicit choice, grouped by moneda so PEN/USD amounts are never compared as
// raw numbers.
export function AgenciaCandidatoPicker({
  open,
  tourNombre,
  candidatos,
  onPick,
  onClose,
}: {
  open: boolean;
  tourNombre: string;
  candidatos: AgenciaCandidato[];
  onPick: (candidato: AgenciaCandidato) => void;
  onClose: () => void;
}) {
  const pen = candidatos.filter((c) => c.moneda === "PEN");
  const usd = candidatos.filter((c) => c.moneda === "USD");

  return (
    <Modal open={open} onClose={onClose} maxW="sm">
      <h2 className="font-playfair text-primary text-xl font-semibold mb-2">Selecciona una agencia</h2>
      <p className="font-nunito text-sm text-text-espresso-soft mb-4">
        {tourNombre} tiene varias agencias con precios en distinta moneda. Elige con cuál registrar la venta.
      </p>

      {pen.length > 0 && (
        <div className="mb-4">
          <p className="font-nunito text-xs font-semibold text-text-espresso-soft uppercase mb-1">Precios en soles</p>
          <ul className="divide-y divide-gold/20">
            {pen.map((c) => (
              <li key={`${c.agencia_id}-PEN`}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className="w-full px-3 py-2 flex justify-between gap-3 text-left hover:bg-gold/10 rounded-lg"
                >
                  <span>{c.agencia_nombre ?? `Agencia ${c.agencia_id}`}</span>
                  <span className="tabular-nums shrink-0">{formatMonto(c)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {usd.length > 0 && (
        <div className="mb-4">
          <p className="font-nunito text-xs font-semibold text-text-espresso-soft uppercase mb-1">Precios en dólares</p>
          <ul className="divide-y divide-gold/20">
            {usd.map((c) => (
              <li key={`${c.agencia_id}-USD`}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className="w-full px-3 py-2 flex justify-between gap-3 text-left hover:bg-gold/10 rounded-lg"
                >
                  <span>{c.agencia_nombre ?? `Agencia ${c.agencia_id}`}</span>
                  <span className="tabular-nums shrink-0">{formatMonto(c)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outlined" type="button" onClick={onClose}>Cancelar</Button>
      </div>
    </Modal>
  );
}
