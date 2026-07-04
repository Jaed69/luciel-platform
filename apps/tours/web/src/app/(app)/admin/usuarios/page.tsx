import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";

export default async function UsuariosPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = (session.user as any)?.role;
  if (role !== "admin") redirect("/ventas");
  const currentUserId = (session.user as any)?.id;

  // Plan 02 fetches real /usuarios. MVP slice shows a static table for now.
  // The backend /usuarios endpoint isn't implemented in Plan 02.1-01 (only /auth/login exists).
  // The Usuarios page is rendered for route/visual verification only.
  const usuarios = [
    { id: 1, email: "admin@tours.luciel.dev", username: "admin", rol: "admin", activo: true, ultimo_acceso: null },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-playfair text-primary text-[38px] font-semibold">Usuarios</h1>
        <Button variant="primary">Nuevo usuario</Button>
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
              const isLastAdmin = u.rol === "admin" && usuarios.filter((x) => x.rol === "admin" && x.activo).length === 1;
              const deleteDisabled = isSelf || isLastAdmin;
              return (
                <tr key={u.id} className={i % 2 === 1 ? "bg-stone-wall/30" : "bg-canvas"}>
                  <td className="px-3 py-2 text-[13px]">{u.email}</td>
                  <td className="px-3 py-2 text-[13px]">{u.username}</td>
                  <td className="px-3 py-2">
                    <StatusBadge variant={u.rol === "admin" ? "active" : "inactive"}>
                      {u.rol}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2 text-[13px]">{u.activo ? "Activo" : "Inactivo"}</td>
                  <td className="px-3 py-2 text-[13px] text-text-espresso-soft">{u.ultimo_acceso ?? "—"}</td>
                  <td className="px-3 py-2 text-[13px]">
                    <span className="flex gap-3">
                      <a href="#" className="text-primary hover:underline">Editar</a>
                      <a href="#" className="text-primary hover:underline">Restablecer contraseña</a>
                      {deleteDisabled ? (
                        <span title="Último admin o cuenta propia" className="text-chili-red/50 cursor-not-allowed">
                          Eliminar
                        </span>
                      ) : (
                        <a href="#" className="text-chili-red hover:underline">Eliminar</a>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}