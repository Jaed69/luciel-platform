// apps/tours/web/tests/catalogos.test.tsx
// Plan 02.1-02 — S5 Comisiones tab: 6 sub-nav tabs + default global row Eliminar disabled + tooltip.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComisionesTab } from "../src/app/(app)/catalogos/_components/ComisionesTab";

const MOCK_REGLAS = [
  { id: 1, vendedor_id: null, tour_id: null, porcentaje: 50, descripcion: "Default global 50/50", activo: true },
  { id: 2, vendedor_id: 1, tour_id: null, porcentaje: 10, descripcion: "vendedor 10", activo: true },
  { id: 3, vendedor_id: null, tour_id: 1, porcentaje: 8, descripcion: "tour 8", activo: true },
  { id: 4, vendedor_id: 1, tour_id: 1, porcentaje: 12, descripcion: "v+t 12", activo: true },
];

const TABS = ["Agencias", "Tours", "Vendedores", "Formas de pago", "Monedas", "Comisiones"];

describe("Catálogos Comisiones tab — S5", () => {
  it("renders 6 sub-nav tabs (Agencias, Tours, Vendedores, Formas de pago, Monedas, Comisiones)", () => {
    render(<ComisionesTab reglas={MOCK_REGLAS} tabs={TABS} />);
    for (const label of TABS) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("default global row has Eliminar disabled with 'Regla global por defecto — no eliminable' tooltip", () => {
    render(<ComisionesTab reglas={MOCK_REGLAS} tabs={TABS} />);
    const defaultRow = MOCK_REGLAS[0];
    const eliminar = screen.getByTitle(`Regla global por defecto — no eliminable`);
    expect(eliminar).toBeTruthy();
    expect(eliminar.hasAttribute("disabled")).toBe(true);
    // Default row grouped by "global" Origen.
    expect(screen.getByText("global")).toBeTruthy();
  });

  it("Origen column classifies each rule: vendedor+tour, vendedor, tour, global", () => {
    render(<ComisionesTab reglas={MOCK_REGLAS} tabs={TABS} />);
    expect(screen.getByText("vendedor+tour")).toBeTruthy();
    expect(screen.getByText("vendedor")).toBeTruthy();
    expect(screen.getByText("tour")).toBeTruthy();
    expect(screen.getByText("global")).toBeTruthy();
  });
});