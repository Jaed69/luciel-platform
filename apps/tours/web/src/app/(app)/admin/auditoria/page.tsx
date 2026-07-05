// apps/tours/web/src/app/(app)/admin/auditoria/page.tsx
// S6 — Auditoría viewer admin-only: filter + dense table + expandable JSON.
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiFetchJson } from "@/lib/api";
import { redirect } from "next/navigation";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { AuditRowExpander } from "./_components/AuditRowExpander";

type AuditLogRow = {
  id: number;
  tabla: string;
  registro_id: number | null;
  operacion: "I" | "U" | "D";
  datos_antes: string | null;
  datos_despues: string | null;
  usuario_id: number | null;
  timestamp: string;
};

const TABLES_AUDITADAS = [
  "usuarios", "contactos", "cuentas", "asientos", "asiento_lineas", "modulos",
  "tours_catalogo", "liquidaciones", "tours_servicios", "comision_reglas",
  "agencias", "vendedores", "formas_pago", "monedas",
];

function accionVariant(op: "I" | "U" | "D"): "insert" | "update" | "delete" {
  return op === "I" ? "insert" : op === "U" ? "update" : "delete";
}

function pretty(d: string | null): { pretty: string | null; passwordNull: boolean } {
  if (!d) return { pretty: null, passwordNull: false };
  try {
    const obj = JSON.parse(d);
    if (obj && typeof obj === "object") {
      // D-26 — surface password_hash as null in UI (already redacted in backend).
      obj.password_hash = null;
    }
    return { pretty: JSON.stringify(obj, null, 2), passwordNull: true };
  } catch {
    return { pretty: d, passwordNull: false };
  }
}

export default async function AuditoriaPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (role !== "admin") redirect("/ventas");

  const qs = new URLSearchParams();
  if (searchParams.usuario_id) qs.set("usuario_id", searchParams.usuario_id);
  if (searchParams.tabla) qs.set("tabla", searchParams.tabla);
  if (searchParams.operacion) qs.set("operacion", searchParams.operacion);

  let rows: AuditLogRow[] = [];
  try {
    rows = await apiFetchJson<AuditLogRow[]>(`/audit-log${qs.toString() ? `?${qs.toString()}` : ""}`);
  } catch {}

  return (
    <div>
      <h1 className="font-playfair text-primary text-[38px] font-semibold mb-6">Auditoría</h1>

      <form className="bg-canvas rounded-xl shadow-lg p-4 border border-gold/30 flex flex-wrap gap-3 items-end mb-4">
        <div className="flex flex-col">
          <label htmlFor="usuario_id" className="text-sm font-nunito font-semibold text-text-espresso-soft mb-1">Usuario ID</label>
          <input id="usuario_id" type="number" name="usuario_id" defaultValue={searchParams.usuario_id ?? ""} className="border border-gold/40 rounded px-2 py-1.5 text-sm font-nunito" />
        </div>
        <div className="flex flex-col">
          <label htmlFor="tabla" className="text-sm font-nunito font-semibold text-text-espresso-soft mb-1">Tabla</label>
          <select id="tabla" name="tabla" defaultValue={searchParams.tabla ?? ""} className="border border-gold/40 rounded px-2 py-1.5 text-sm font-nunito">
            <option value="">Todas</option>
            {TABLES_AUDITADAS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex flex-col">
          <label htmlFor="operacion" className="text-sm font-nunito font-semibold text-text-espresso-soft mb-1">Acción</label>
          <select id="operacion" name="operacion" defaultValue={searchParams.operacion ?? ""} className="border border-gold/40 rounded px-2 py-1.5 text-sm font-nunito">
            <option value="">Todas</option>
            <option value="I">INSERT</option>
            <option value="U">UPDATE</option>
            <option value="D">DELETE</option>
          </select>
        </div>
        <Button variant="primary" size="sm" type="submit">Filtrar</Button>
        <Button variant="outlined" size="sm" type="reset">Limpiar</Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gold/30">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-primary text-on-primary">
            <tr>
              <th className="text-left px-2 py-2 text-[13px] font-semibold">Usuario</th>
              <th className="text-left px-2 py-2 text-[13px] font-semibold">Tabla</th>
              <th className="text-left px-2 py-2 text-[13px] font-semibold">Registro ID</th>
              <th className="text-left px-2 py-2 text-[13px] font-semibold">Acción</th>
              <th className="text-left px-2 py-2 text-[13px] font-semibold">Fecha</th>
              <th className="text-left px-2 py-2 text-[13px] font-semibold">Datos</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-espresso-soft font-nunito">
                  Sin entradas de auditoría para este filtro.
                </td>
              </tr>
            )}
            {rows.map((row, i) => {
              const antes = pretty(row.datos_antes);
              const despues = pretty(row.datos_despues);
              return (
                <tr key={row.id} className={i % 2 === 1 ? "bg-stone-wall/30" : "bg-canvas"}>
                  <td className="px-2 py-1.5 text-[13px] font-nunito text-text-espresso tabular-nums">{row.usuario_id ?? "—"}</td>
                  <td className="px-2 py-1.5 text-[13px] font-nunito text-text-espresso">{row.tabla}</td>
                  <td className="px-2 py-1.5 text-[13px] font-nunito text-text-espresso tabular-nums">{row.registro_id ?? "—"}</td>
                  <td className="px-2 py-1.5">
                    <StatusBadge variant={accionVariant(row.operacion)}>{row.operacion}</StatusBadge>
                  </td>
                  <td className="px-2 py-1.5 text-[13px] font-nunito text-text-espresso tabular-nums">{new Date(row.timestamp).toLocaleString("es-PE")}</td>
                  <td className="px-2 py-1.5">
                    <AuditRowExpander antes={antes} despues={despues} rowId={row.id} />
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