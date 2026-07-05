// apps/tours/web/tests/catalogos.test.tsx
// Plan 02.1-02 — S5 Comisiones tab: 6 sub-nav tabs + default global row Eliminar disabled + tooltip.
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
    const nav = screen.getByLabelText("Catálogos sub-nav");
    for (const label of TABS) {
      expect(within(nav).getByText(label)).toBeTruthy();
    }
  });

  it("default global row has Eliminar disabled with 'Regla global por defecto — no eliminable' tooltip", () => {
    render(<ComisionesTab reglas={MOCK_REGLAS} tabs={TABS} />);
    const eliminarButtons = screen.getAllByTitle("Regla global por defecto — no eliminable");
    expect(eliminarButtons.length).toBe(1);
    const eliminar = eliminarButtons[0];
    expect(eliminar.hasAttribute("disabled")).toBe(true);
  });

  it("Origen column classifies each rule: vendedor+tour, vendedor, tour, global", () => {
    render(<ComisionesTab reglas={MOCK_REGLAS} tabs={TABS} />);
    // 4 origins, one each.
    expect(screen.getAllByText("vendedor+tour").length).toBe(1);
    expect(screen.getAllByText("vendedor").length).toBe(1);
    expect(screen.getAllByText("tour").length).toBe(1);
    expect(screen.getAllByText("global").length).toBe(1);
  });
});