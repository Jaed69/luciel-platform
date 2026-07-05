import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiFetchJson } from "@/lib/api";
import { redirect } from "next/navigation";
import { Button } from "@/components/Button";
import { DataTable, type Column } from "@/components/DataTable";
import { ComisionesTab } from "../_components/ComisionesTab";

type Row = { id: number; codigo?: string; nombre: string; activo: boolean };

const ENTIDADES = ["agencias", "tours", "vendedores", "formas-pago", "monedas", "comisiones"] as const;
const ENTIDAD_LABEL: Record<string, string> = {
  agencias: "agencia",
  tours: "tour",
  vendedores: "vendedor",
  "formas-pago": "forma de pago",
  monedas: "moneda",
  comisiones: "regla de comisión",
};

type ComisionReglaRow = {
  id: number;
  vendedor_id: number | null;
  tour_id: number | null;
  porcentaje: number;
  descripcion: string | null;
  activo: boolean;
};

export default async function CatalogoPage({ params }: { params: { entidad: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/ventas");

  const { entidad } = params;
  if (!ENTIDADES.includes(entidad as any)) redirect("/catalogos/agencias");

  // Special path for Comisiones tab — render with the ComisionesTab component (S5).
  if (entidad === "comisiones") {
    let reglas: ComisionReglaRow[] = [];
    try {
      reglas = await apiFetchJson<ComisionReglaRow[]>(`/comision-reglas`);
    } catch {}
    return <ComisionesTab reglas={reglas} tabs={[...ENTIDADES]} />;
  }

  let data: Row[] = [];
  try {
    data = await apiFetchJson<Row[]>(`/${entidad}`);
  } catch {}

  const label = ENTIDAD_LABEL[entidad] || entidad;
  const columns: Column<Row>[] = [
    { key: "codigo", header: "Código", render: (r) => r.codigo ?? "—" },
    { key: "nombre", header: "Nombre", render: (r) => r.nombre },
    {
      key: "estado",
      header: "Estado",
      render: (r) => (r.activo ? "Activo" : <span className="opacity-60">Inactivo</span>),
    },
    {
      key: "acciones",
      header: "Acciones",
      render: (r) => (
        <span className="flex gap-3">
          <a href="#" className="text-primary hover:underline">Editar</a>
          {!r.activo ? (
            <a href="#" className="text-primary hover:underline">Restaurar</a>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-playfair text-primary text-[38px] font-semibold capitalize">{entidad.replace("-", " ")}</h1>
        <Button variant="primary">Agregar {label}</Button>
      </div>
      <nav className="flex gap-2 mb-4" aria-label="Catálogos sub-nav">
        {ENTIDADES.map((e) => (
          <a
            key={e}
            href={`/catalogos/${e}`}
            className={`px-3 py-1.5 rounded-full text-sm font-nunito font-semibold ${e === entidad ? "bg-primary text-on-primary" : "text-primary border border-gold/30"}`}
          >
            {e.replace("-", " ")}
          </a>
        ))}
      </nav>
      <DataTable
        columns={columns}
        data={data}
        emptyState={`No hay ${entidad} cargadas todavía.`}
      />
    </div>
  );
}