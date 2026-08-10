import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiFetchJson } from "@/lib/api";
import { VentaTable } from "./components/VentaTable";
import { VentaFormModal } from "./components/VentaFormModal";
import { TrasladoFormModal } from "./components/TrasladoFormModal";

// D-36 — pestañas Tours/Traslados por query param: /liquidaciones/[id] ya usa
// [id] como segmento dinámico bajo /liquidaciones/, así que una ruta hermana
// tipo /ventas/traslados arriesgaría colisiones equivalentes ahí; el query
// param evita el problema por completo.
function SubNavTabs({ tipo }: { tipo: "tour" | "traslado" }) {
  const tabs: { value: "tour" | "traslado"; label: string }[] = [
    { value: "tour", label: "Tours" },
    { value: "traslado", label: "Traslados" },
  ];
  return (
    <nav className="flex flex-wrap gap-2 mb-4" aria-label="Ventas sub-nav">
      {tabs.map((t) => (
        <a
          key={t.value}
          href={`/ventas?tipo=${t.value}`}
          className={`px-3 py-1.5 rounded-full text-sm font-nunito font-semibold ${t.value === tipo ? "bg-primary text-on-primary" : "text-primary border border-gold/30"}`}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const vendedorId = (session?.user as any)?.vendedorId as string | undefined;

  const filtros = await searchParams;
  const tipo: "tour" | "traslado" = filtros.tipo === "traslado" ? "traslado" : "tour";

  const qs = new URLSearchParams({ tipo_servicio: tipo });
  if (role === "vendedor") qs.set("vendedor_id", vendedorId ?? "");

  const [ventas, tours, vendedores, agencias] = await Promise.all([
    apiFetchJson<any[]>(`/ventas?${qs.toString()}`).catch(() => []),
    apiFetchJson<any[]>("/tours").catch(() => []),
    apiFetchJson<any[]>("/vendedores").catch(() => []),
    apiFetchJson<any[]>("/agencias").catch(() => []),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-playfair text-primary text-[38px] font-semibold">Ventas</h1>
        {tipo === "traslado" ? (
          <TrasladoFormModal role={role} vendedorId={vendedorId} />
        ) : (
          <VentaFormModal role={role} vendedorId={vendedorId} />
        )}
      </div>
      <SubNavTabs tipo={tipo} />
      <VentaTable ventas={ventas} tours={tours} vendedores={vendedores} agencias={agencias} />
    </div>
  );
}
