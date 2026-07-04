import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiFetchJson } from "@/lib/api";
import { VentaTable } from "./components/VentaTable";
import { VentaFormModal } from "./components/VentaFormModal";

export default async function VentasPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  let ventasUrl = "/ventas";
  if (role === "vendedor") ventasUrl += `?vendedor_id=${userId}`;

  const ventas = await apiFetchJson<any[]>(ventasUrl).catch(() => []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-playfair text-primary text-[38px] font-semibold">Ventas</h1>
        <VentaFormModal />
      </div>
      <VentaTable ventas={ventas} />
    </div>
  );
}