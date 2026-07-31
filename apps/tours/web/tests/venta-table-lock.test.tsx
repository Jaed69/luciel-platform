// apps/tours/web/tests/venta-table-lock.test.tsx
// D-14 — el bloqueo de edición aplica sólo a la liquidación *cerrada*. Antes la
// tabla bloqueaba con sólo tener `liquidacion_id`, dejando sin salida a las
// ventas de una liquidación abierta (ni editar ni eliminar).
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VentaTable } from "../src/app/(app)/ventas/components/VentaTable";

const base = {
  id: 1,
  tour_id: 1,
  vendedor_id: 1,
  agencia_id: 1,
  forma_pago_id: 1,
  moneda: "PEN" as const,
  monto: 100,
  costo: 60,
  fecha: "2026-07-04",
  asiento_id: 1,
};

describe("VentaTable — bloqueo por liquidación", () => {
  it("permite editar y eliminar una venta sin liquidación", () => {
    render(<VentaTable ventas={[{ ...base, liquidacion_id: null, liquidacion_estado: null }]} />);
    expect(screen.getByText("Editar")).toBeTruthy();
    expect(screen.getByText("Eliminar")).toBeTruthy();
  });

  it("permite editar y eliminar una venta en liquidación abierta", () => {
    render(<VentaTable ventas={[{ ...base, liquidacion_id: 7, liquidacion_estado: "abierta" }]} />);
    expect(screen.getByText("Editar")).toBeTruthy();
    expect(screen.getByText("Eliminar")).toBeTruthy();
    expect(screen.queryByText(/liquidación cerrada/i)).toBeNull();
  });

  it("bloquea sólo cuando la liquidación está cerrada, con link para reabrirla", () => {
    render(
      <VentaTable ventas={[{ ...base, liquidacion_id: 7, liquidacion_estado: "cerrada", liquidacion_codigo: "LIQ-2026-001" }]} />,
    );
    expect(screen.queryByText("Editar")).toBeNull();
    expect(screen.queryByText("Eliminar")).toBeNull();
    expect(screen.getByText(/liquidación cerrada/i)).toBeTruthy();
    expect(screen.getByText("Reabre la liquidación").getAttribute("href")).toBe("/liquidaciones/7");
  });

  it("desbloquea de nuevo cuando la liquidación fue revertida", () => {
    render(<VentaTable ventas={[{ ...base, liquidacion_id: 7, liquidacion_estado: "revertida" }]} />);
    expect(screen.getByText("Editar")).toBeTruthy();
  });
});
