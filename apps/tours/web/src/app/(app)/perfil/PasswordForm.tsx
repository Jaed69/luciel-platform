"use client";
import { useState } from "react";
import { Button } from "@/components/Button";
import { FloatingLabelInput } from "@/components/FloatingLabelInput";
import { showToast } from "@/components/Toast";

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setClientError(null);

    if (!currentPassword || !newPassword || !confirmNew) {
      setClientError("Completa todos los campos");
      return;
    }
    if (newPassword.length < 8) {
      setClientError("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmNew) {
      setClientError("Las contraseñas no coinciden");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/usuarios/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      if (res.ok) {
        showToast("success", "Contraseña actualizada");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNew("");
      } else if (res.status === 401) {
        showToast("error", "Contraseña actual incorrecta");
      } else {
        showToast("error", "Error al cambiar la contraseña");
      }
    } catch {
      showToast("error", "Error al cambiar la contraseña");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gold/30 bg-canvas p-6 max-w-[640px]">
      <h2 className="font-playfair text-primary text-2xl font-semibold mb-4">Cambiar contraseña</h2>
      <div className="grid gap-3">
        <FloatingLabelInput
          label="Contraseña actual"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <FloatingLabelInput
          label="Nueva contraseña"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <FloatingLabelInput
          label="Confirmar nueva contraseña"
          type="password"
          value={confirmNew}
          onChange={(e) => setConfirmNew(e.target.value)}
          required
        />
        {clientError && (
          <p className="text-chili-red text-sm font-nunito">{clientError}</p>
        )}
        <div className="mt-2">
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? "Guardando..." : "Cambiar contraseña"}
          </Button>
        </div>
      </div>
    </form>
  );
}