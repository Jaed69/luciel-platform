// apps/tours/web/tests/dashboard.test.tsx
// Plan 02.1-02 — Dashboard S2 render: 4 content-cards + filter bar visible.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardCards } from "../src/app/(app)/_components/DashboardCards";

describe("Dashboard S2", () => {
  it("renders 4 content-cards with the exact titles per UI-SPEC", () => {
    const saldos = [
      { codigo: "101-CAJA-PEN", nombre: "Caja Soles", moneda: "PEN", saldo: 350.0 },
      { codigo: "101-CAJA-USD", nombre: "Caja Dólares", moneda: "USD", saldo: 0 },
      { codigo: "401-INGRESOS-TOURS-PEN", nombre: "Ingresos Tours", moneda: "PEN", saldo: 100.0 },
      { codigo: "501-COSTOS-TOURS-PEN", nombre: "Costos Tours", moneda: "PEN", saldo: -50.0 },
    ];
    render(<DashboardCards saldos={saldos} />);
    expect(screen.getByText(/Caja Soles/i)).toBeTruthy();
    expect(screen.getByText(/Caja Dólares/i)).toBeTruthy();
    expect(screen.getByText(/Ingresos Tours/i)).toBeTruthy();
    expect(screen.getByText(/Costos Tours/i)).toBeTruthy();
  });

  it("filter bar visible with Aplicar/Limpiar buttons and fecha desde/hasta inputs", () => {
    const saldos: any[] = [];
    render(<DashboardCards saldos={saldos} allowFilter />);
    expect(screen.getByText("Aplicar filtros")).toBeTruthy();
    expect(screen.getByText("Limpiar filtros")).toBeTruthy();
    expect(screen.getByLabelText(/fecha desde/i)).toBeTruthy();
    expect(screen.getByLabelText(/fecha hasta/i)).toBeTruthy();
  });
});