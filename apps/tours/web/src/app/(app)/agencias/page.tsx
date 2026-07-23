import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { apiFetchJson } from "@/lib/api";

type Agencia = { id: number; codigo?: string; nombre: string; activo: boolean };
type Saldo = { agencia_id: number; PEN: number; USD: number };

export default async function AgenciasPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = (session.user as any)?.role;
  if (!["admin", "contabilidad"].includes(role)) redirect("/ventas");

  const agencias: Agencia[] = await apiFetchJson<Agencia[]>("/agencias").catch(() => []);
  const saldos = await Promise.all(
    agencias.map((a) => apiFetchJson<Saldo>(`/agencias/${a.id}/saldo`).catch(() => ({ agencia_id: a.id, PEN: 0, USD: 0 }))),
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-playfair text-primary text-[38px] font-semibold">Saldos agencias</h1>
        <a href="/agencias/comparativo" className="text-sm font-nunito text-primary hover:underline">
          Ver comparativo de precios →
        </a>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gold/30">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-primary text-on-primary">
            <tr>
              <th className="text-left px-3 py-2 text-sm font-semibold border-b border-gold">Nombre</th>
              <th className="text-left px-3 py-2 text-sm font-semibold border-b border-gold">Saldo (PEN)</th>
              <th className="text-left px-3 py-2 text-sm font-semibold border-b border-gold">Saldo (USD)</th>
            </tr>
          </thead>
          <tbody>
            {agencias.map((a, i) => {
              const saldo = saldos.find((s) => s.agencia_id === a.id) ?? { PEN: 0, USD: 0 };
              return (
                <tr key={a.id} className={i % 2 === 1 ? "bg-stone-wall/30" : "bg-canvas"}>
                  <td className="px-3 py-2 text-[13px]">
                    <a href={`/agencias/${a.id}`} className="text-primary hover:underline font-semibold">{a.nombre}</a>
                  </td>
                  <td className="px-3 py-2 text-[13px] tabular-nums">S/ {saldo.PEN}</td>
                  <td className="px-3 py-2 text-[13px] tabular-nums">$ {saldo.USD}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
