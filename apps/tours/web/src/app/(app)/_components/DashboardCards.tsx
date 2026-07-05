// apps/tours/web/src/app/(app)/_components/DashboardCards.tsx
// S2 — 4 content-cards (Caja Soles, Caja Dólares, Ingresos Tours, Costos Tours) + optional filter bar.
"use client";

import { ReactNode } from "react";
import { Button } from "@/components/Button";
import { formatCurrency } from "@/lib/api";

export type SaldosRow = {
  id: number;
  codigo: string;
  nombre: string;
  moneda: "PEN" | "USD";
  saldo: number;
  total_debe?: number;
  total_haber?: number;
};

const CARD_TITLES: { codigo: string; title: string; moneda: "PEN" | "USD" }[] = [
  { codigo: "101-CAJA-PEN", title: "Caja Soles (S/)", moneda: "PEN" },
  { codigo: "101-CAJA-USD", title: "Caja Dólares ($)", moneda: "USD" },
  { codigo: "401-INGRESOS-TOURS-PEN", title: "Ingresos Tours", moneda: "PEN" },
  { codigo: "501-COSTOS-TOURS-PEN", title: "Costos Tours", moneda: "PEN" },
];

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-canvas rounded-xl shadow-lg p-6 border border-gold/30 hover:border-gold/60 transition-colors">
      <h2 className="font-nunito font-semibold text-text-espresso-soft text-sm mb-2">{title}</h2>
      {children}
    </div>
  );
}

export function DashboardCards({ saldos, allowFilter = false }: { saldos: SaldosRow[]; allowFilter?: boolean }) {
  const find = (codigo: string): SaldosRow | undefined => saldos.find((r) => r.codigo === codigo);
  const cardFor = (codigo: string) => find(codigo) ?? { codigo, nombre: "", moneda: "PEN" as const, saldo: 0 };
  return (
    <div className="space-y-4">
      {allowFilter && (
        <form className="bg-canvas rounded-xl shadow-lg p-4 border border-gold/30 flex flex-wrap gap-3 items-end" onSubmit={(e) => e.preventDefault}>
          <div className="flex flex-col">
            <label htmlFor="fecha_desde" className="text-sm font-nunito font-semibold text-text-espresso-soft mb-1">
              Fecha desde
            </label>
            <input id="fecha_desde" type="date" name="fecha_desde" className="border border-gold/40 rounded px-2 py-1.5 text-sm font-nunito" />
          </div>
          <div className="flex flex-col">
            <label htmlFor="fecha_hasta" className="text-sm font-nunito font-semibold text-text-espresso-soft mb-1">
              Fecha hasta
            </label>
            <input id="fecha_hasta" type="date" name="fecha_hasta" className="border border-gold/40 rounded px-2 py-1.5 text-sm font-nunito" />
          </div>
          <div className="flex flex-col">
            <label htmlFor="agencia" className="text-sm font-nunito font-semibold text-text-espresso-soft mb-1">Agencia</label>
            <select id="agencia" name="agencia" className="border border-gold/40 rounded px-2 py-1.5 text-sm font-nunito">
              <option value="">Todas</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label htmlFor="vendedor" className="text-sm font-nunito font-semibold text-text-espresso-soft mb-1">Vendedor</label>
            <select id="vendedor" name="vendedor" className="border border-gold/40 rounded px-2 py-1.5 text-sm font-nunito">
              <option value="">Todos</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label htmlFor="moneda" className="text-sm font-nunito font-semibold text-text-espresso-soft mb-1">Moneda</label>
            <select id="moneda" name="moneda" className="border border-gold/40 rounded px-2 py-1.5 text-sm font-nunito">
              <option value="">Ambas</option>
              <option value="PEN">PEN</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <Button variant="primary" size="sm" type="submit">Aplicar filtros</Button>
          <Button variant="outlined" size="sm" type="reset">Limpiar filtros</Button>
        </form>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {CARD_TITLES.map((c) => {
          const row = cardFor(c.codigo);
          const saldo = row.saldo || 0;
          const negative = saldo < 0;
          return (
            <Card key={c.codigo} title={c.title}>
              <p
                className={`font-playfair text-[28px] font-semibold tabular-nums ${negative ? "text-chili-red" : "text-text-espresso"}`}
                aria-label={c.title}
              >
                {formatCurrency(saldo, c.moneda)}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}