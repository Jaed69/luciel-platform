import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiFetchJson } from "@/lib/api";
import { redirect } from "next/navigation";
import { ComisionesTab } from "../_components/ComisionesTab";
import { CatalogoPageClient } from "./_components/CatalogoPageClient";

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
  // D-13 — admin + contabilidad can access catalogos (was admin-only).
  const role = (session.user as any)?.role;
  if (!["admin", "contabilidad"].includes(role)) redirect("/ventas");

  const { entidad } = params;
  if (!ENTIDADES.includes(entidad as any)) redirect("/catalogos/agencias");

  // Special path for Comisiones tab — render with the ComisionesTab component (S5).
  // The early-return preserves the existing behavior (no PUT wrap for comisiones).
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

  return <CatalogoPageClient data={data} entidad={entidad} label={label} />;
}