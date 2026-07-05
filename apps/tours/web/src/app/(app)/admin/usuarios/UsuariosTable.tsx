"use client";
import { useState } from "react";
import { Button } from "@/components/Button";
import { UsuarioFormModal } from "@/components/UsuarioFormModal";
import { showToast } from "@/components/Toast";

type UsuarioRow = {
  id: number;
  email: string;
  username: string;
  rol: string;
  activo: boolean;
  ultimo_acceso: string | null;
};

export function UsuariosTable({ usuarios, currentUserId }: { usuarios: UsuarioRow[]; currentUserId: number }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UsuarioRow | null>(null);

  const activeAdmins = usuarios.filter((u) => u.rol === "admin" && u.activo);

  function openCreate() {
    setEditTarget(null);
    setModalOpen(true);
  }
  function openEdit(u: UsuarioRow) {
    setEditTarget(u);
    setModalOpen(true);
  }

  async function handleDelete(u: UsuarioRow) {
    if (!window.confirm(`¿Eliminar usuario ${u.email}?`)) return;
    const res = await fetch(`/api/usuarios/${u.id}`, { method: "DELETE" });
    if (res.ok) {
      window.location.reload();
    } else {
      try {
        const err = await res.json();
        const msg = typeof err.detail === "string" ? err.detail : (err.detail?.mensaje ?? "Error al eliminar");
        showToast("error", msg);
      } catch {
        showToast("error", "Error al eliminar");
      }
    }
  }

  async function handleResetPassword(u: UsuarioRow) {
    const np = window.prompt("Nueva contraseña (mínimo 8 caracteres):");
    if (!np) return;
    if (np.length < 8) {
      showToast("error", "La contraseña debe tener al menos 8 caracteres");
      return;
    }
    const res = await fetch(`/api/usuarios/${u.id}/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_password: np }),
    });
    if (res.ok) {
      showToast("success", "Contraseña restablecida");
    } else {
      showToast("error", "Error al restablecer");
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button variant="primary" onClick={openCreate}>Nuevo usuario</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gold/30">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-primary text-on-primary">
            <tr>
              <th className="text-left px-3 py-2 text-sm font-semibold border-b border-gold">Correo</th>
              <th className="text-left px-3 py-2 text-sm font-semibold border-b border-gold">Nombre</th>
              <th className="text-left px-3 py-2 text-sm font-semibold border-b border-gold">Rol</th>
              <th className="text-left px-3 py-2 text-sm font-semibold border-b border-gold">Estado</th>
              <th className="text-left px-3 py-2 text-sm font-semibold border-b border-gold">Último acceso</th>
              <th className="text-left px-3 py-2 text-sm font-semibold border-b border-gold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u, i) => {
              const isSelf = u.id === currentUserId;
              const isLastAdmin = u.rol === "admin" && u.activo && activeAdmins.length === 1;
              const deleteDisabled = isSelf || isLastAdmin || !u.activo;
              return (
                <tr key={u.id} className={i % 2 === 1 ? "bg-stone-wall/30" : "bg-canvas"}>
                  <td className="px-3 py-2 text-[13px]">{u.email}</td>
                  <td className="px-3 py-2 text-[13px]">{u.username}</td>
                  <td className="px-3 py-2 text-[13px]">{u.rol}</td>
                  <td className="px-3 py-2 text-[13px]">{u.activo ? "Activo" : "Inactivo"}</td>
                  <td className="px-3 py-2 text-[13px] text-text-espresso-soft">{u.ultimo_acceso ?? "—"}</td>
                  <td className="px-3 py-2 text-[13px]">
                    <span className="flex gap-3">
                      <button type="button" className="text-primary hover:underline" onClick={() => openEdit(u)}>Editar</button>
                      <button type="button" className="text-primary hover:underline" onClick={() => handleResetPassword(u)}>Restablecer contraseña</button>
                      {deleteDisabled ? (
                        <span title={isSelf ? "Cuenta propia" : isLastAdmin ? "Último admin" : "Usuario inactivo"} className="text-chili-red/50 cursor-not-allowed">
                          Eliminar
                        </span>
                      ) : (
                        <button type="button" className="text-chili-red hover:underline" onClick={() => handleDelete(u)}>Eliminar</button>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <UsuarioFormModal
        mode={editTarget ? "edit" : "create"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editTarget}
        onSaved={() => {
          setModalOpen(false);
          window.location.reload();
        }}
      />
    </div>
  );
}