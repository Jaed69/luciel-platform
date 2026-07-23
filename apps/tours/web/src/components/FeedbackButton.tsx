"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { showToast } from "./Toast";

const TIPOS = ["bug", "mejora", "solicitud"] as const;
const PRIORIDADES = ["baja", "media", "alta"] as const;

export function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>("bug");
  const [prioridad, setPrioridad] = useState<(typeof PRIORIDADES)[number]>("media");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setTitulo("");
    setDescripcion("");
    setTipo("bug");
    setPrioridad("media");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const res = await fetch("/api/solicitudes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo, descripcion, tipo, prioridad, pagina_origen: pathname }),
    });
    setSubmitting(false);
    if (res.ok) {
      showToast("success", "Gracias, tu solicitud fue enviada.");
      reset();
      setOpen(false);
    } else {
      showToast("error", "No se pudo enviar la solicitud.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-primary text-on-primary shadow-lg px-5 py-3 font-nunito font-semibold hover:bg-wine-muted transition-colors"
      >
        Reportar / Sugerir
      </button>
      <Modal open={open} onClose={() => setOpen(false)} maxW="md">
        <h2 className="font-playfair text-primary text-2xl font-semibold mb-4">Nueva solicitud</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
          <label className="block">
            <span className="text-sm font-nunito text-text-espresso-soft">Título</span>
            <input
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas"
            />
          </label>
          <label className="block">
            <span className="text-sm font-nunito text-text-espresso-soft">Descripción</span>
            <textarea
              required
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas"
              rows={4}
            />
          </label>
          <label className="block">
            <span className="text-sm font-nunito text-text-espresso-soft">Tipo</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as (typeof TIPOS)[number])}
              className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas"
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-nunito text-text-espresso-soft">Prioridad</span>
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as (typeof PRIORIDADES)[number])}
              className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas"
            >
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="outlined" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
