import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { apiFetchJson } from "@/lib/api";
import { UsuariosTable } from "./UsuariosTable";

export type UsuarioRow = {
  id: number;
  email: string;
  username: string;
  rol: string;
  activo: boolean;
  ultimo_acceso: string | null;
};

export default async function UsuariosPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = (session.user as any)?.role;
  if (role !== "admin") redirect("/ventas");
  const currentUserId = Number((session.user as any)?.id);

  const usuarios: UsuarioRow[] = await apiFetchJson<UsuarioRow[]>("/usuarios").catch(() => []);

  return (
    <div>
      <h1 className="font-playfair text-primary text-[38px] font-semibold mb-6">Usuarios</h1>
      <UsuariosTable usuarios={usuarios} currentUserId={currentUserId} />
    </div>
  );
}