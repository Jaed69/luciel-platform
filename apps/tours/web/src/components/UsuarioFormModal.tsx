"use client";
import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { showToast } from "./Toast";

type UsuarioFormModalProps = {
  mode: "create" | "edit";
  open: boolean;
  onClose: () => void;
  initial?: { id: number; email: string; username: string; rol: string; activo: boolean } | null;
  onSaved: () => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["admin", "contabilidad", "vendedor"] as const;

export function UsuarioFormModal({ mode, open, onClose, initial, onSaved }: UsuarioFormModalProps) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<string>("vendedor");
  const [activo, setActivo] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail(initial?.email ?? "");
      setUsername(initial?.username ?? "");
      setPassword("");
      setRol(initial?.rol ?? "vendedor");
      setActivo(initial?.activo ?? true);
      setClientError(null);
    }
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setClientError(null);

    if (!EMAIL_RE.test(email)) {
      setClientError("Correo inválido");
      return;
    }
    if (username.length < 3) {
      setClientError("Username debe tener al menos 3 caracteres");
      return;
    }
    if (mode === "create" && password.length < 8) {
      setClientError("Password debe tener al menos 8 caracteres");
      return;
    }

    setSubmitting(true);
    const body =
      mode === "create"
        ? { email, username, password, rol }
        : { email, username, rol, activo };
    const url = mode === "create" ? "/api/usuarios" : `/api/usuarios/${initial?.id}`;
    const method = mode === "create" ? "POST" : "PUT";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (res.ok) {
      showToast("success", mode === "create" ? "Usuario creado" : "Usuario actualizado");
      onSaved();
      onClose();
    } else {
      try {
        const err = await res.json();
        const detail = err.detail;
        const msg = typeof detail === "string" ? detail : (detail?.mensaje ?? "Error");
        showToast("error", msg);
      } catch {
        showToast("error", "Error al guardar");
      }
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxW="md">
      <h2 className="font-playfair text-primary text-2xl font-semibold mb-4">
        {mode === "create" ? "Nuevo usuario" : "Editar usuario"}
      </h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Correo</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas"
          />
        </label>
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Nombre de usuario</span>
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas"
          />
        </label>
        {mode === "create" && (
          <label className="block">
            <span className="text-sm font-nunito text-text-espresso-soft">Contraseña</span>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas"
            />
          </label>
        )}
        <label className="block">
          <span className="text-sm font-nunito text-text-espresso-soft">Rol</span>
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
        {mode === "edit" && (
          <label className="block">
            <span className="text-sm font-nunito text-text-espresso-soft">Activo</span>
            <select
              value={activo ? "true" : "false"}
              onChange={(e) => setActivo(e.target.value === "true")}
              className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas"
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </label>
        )}
        {clientError && (
          <p className="text-chili-red text-sm font-nunito">{clientError}</p>
        )}
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