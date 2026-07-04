import { formatCurrency } from "@/lib/api";
import { DataTable, type Column } from "@/components/DataTable";

type Venta = {
  id: number;
  tour_id: number;
  vendedor_id: number;
  agencia_id: number;
  forma_pago_id: number;
  moneda: "PEN" | "USD";
  monto: number;
  costo: number | null;
  fecha: string;
  asiento_id: number;
  liquidacion_id: number | null;
};

const columns: Column<Venta>[] = [
  { key: "fecha", header: "Fecha", render: (r) => new Date(r.fecha).toLocaleDateString("es-PE") },
  { key: "tour_id", header: "Tour", render: (r) => `T-${r.tour_id}` },
  { key: "vendedor_id", header: "Vendedor", render: (r) => `V-${r.vendedor_id}` },
  { key: "agencia_id", header: "Agencia", render: (r) => `AG-${r.agencia_id}` },
  { key: "forma_pago_id", header: "Forma de pago", render: (r) => `FP-${r.forma_pago_id}` },
  { key: "moneda", header: "Moneda", render: (r) => r.moneda },
  {
    key: "monto",
    header: "Monto",
    render: (r) => <span className="tabular-nums">{formatCurrency(r.monto, r.moneda)}</span>,
  },
  { key: "comision", header: "Comisión estimada", render: () => <span className="text-text-espresso-soft">—</span> },
  {
    key: "liquidacion",
    header: "Liquidación",
    render: (r) => (r.liquidacion_id ? `LIQ-${r.liquidacion_id}` : <span className="text-text-espresso-soft">—</span>),
  },
  {
    key: "acciones",
    header: "Acciones",
    render: (r) =>
      r.liquidacion_id ? (
        <span className="text-chili-red text-[13px]">Tour en liquidación cerrada. Reabre la liquidación para editar.</span>
      ) : (
        <span className="flex gap-2">
          <a href="#" className="text-primary underline-offset-4 hover:underline">Editar</a>
          <a href="#" className="text-chili-red underline-offset-4 hover:underline">Eliminar</a>
        </span>
      ),
  },
];

export function VentaTable({ ventas }: { ventas: Venta[] }) {
  return (
    <DataTable
      columns={columns}
      data={ventas}
      emptyState="No hay ventas registradas. Usa el botón Registrar venta para crear la primera."
    />
  );
}