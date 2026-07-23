import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { apiFetchJson } from "@/lib/api";
import { SolicitudesTable, SolicitudRow } from "./SolicitudesTable";

export default async function SolicitudesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = (session.user as any)?.role as string;

  const solicitudes: SolicitudRow[] = await apiFetchJson<SolicitudRow[]>("/solicitudes").catch(() => []);

  return (
    <div>
      <h1 className="font-playfair text-primary text-[38px] font-semibold mb-6">
        {role === "admin" ? "Solicitudes" : "Mis solicitudes"}
      </h1>
      <SolicitudesTable solicitudes={solicitudes} isAdmin={role === "admin"} />
    </div>
  );
}
