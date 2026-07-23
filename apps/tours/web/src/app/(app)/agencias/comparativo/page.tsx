import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { apiFetchJson } from "@/lib/api";

type Agencia = { id: number; nombre: string; activo: boolean };
type Tour = { id: number; nombre: string; activo: boolean };
type AgenciaPrecio = { agencia_id: number; tour_id: number; precio: number; precio_usd: number | null };

export default async function AgenciasComparativoPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = (session.user as any)?.role;
  if (!["admin", "contabilidad"].includes(role)) redirect("/ventas");

  const [agencias, tours, precios] = await Promise.all([
    apiFetchJson<Agencia[]>("/agencias").catch(() => []),
    apiFetchJson<Tour[]>("/tours").catch(() => []),
    apiFetchJson<AgenciaPrecio[]>("/agencia-precios").catch(() => []),
  ]);

  const agenciasActivas = agencias.filter((a) => a.activo);
  const toursActivos = tours.filter((t) => t.activo);

  const precioDe = (agenciaId: number, tourId: number) =>
    precios.find((p) => p.agencia_id === agenciaId && p.tour_id === tourId) ?? null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-playfair text-primary text-[38px] font-semibold">Comparativo de precios</h1>
        <p className="font-nunito text-text-espresso-soft mt-1">
          Qué agencia ofrece cada tour y a qué precio. Click en un precio para editarlo desde el detalle de la agencia.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gold/30">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-primary text-on-primary">
            <tr>
              <th className="text-left px-3 py-2 text-sm font-semibold border-b border-gold">Tour</th>
              {agenciasActivas.map((a) => (
                <th key={a.id} className="text-left px-3 py-2 text-sm font-semibold border-b border-gold">
                  {a.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {toursActivos.map((t, i) => (
              <tr key={t.id} className={i % 2 === 1 ? "bg-stone-wall/30" : "bg-canvas"}>
                <td className="px-3 py-2 text-[13px] font-semibold">{t.nombre}</td>
                {agenciasActivas.map((a) => {
                  const p = precioDe(a.id, t.id);
                  return (
                    <td key={a.id} className="px-3 py-2 text-[13px] tabular-nums">
                      {p ? (
                        <a href={`/agencias/${a.id}`} className="text-primary hover:underline">
                          S/ {p.precio}
                          {p.precio_usd != null ? <span className="block text-[11px] opacity-70">$ {p.precio_usd}</span> : null}
                        </a>
                      ) : (
                        <span className="opacity-40">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
