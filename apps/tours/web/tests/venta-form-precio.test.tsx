// apps/tours/web/tests/venta-form-precio.test.tsx
// VentaFormModal autofills `costo` from the agencia×tour price list (D-30).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VentaFormModal } from "../src/app/(app)/ventas/components/VentaFormModal";

vi.mock("../src/components/Toast", () => ({ showToast: vi.fn() }));

const CATALOGOS: Record<string, any[]> = {
  "/api/catalogos/tours": [{ id: 1, nombre: "7 Lagunas" }],
  "/api/catalogos/vendedores": [{ id: 1, nombre: "Vendedor demo" }],
  "/api/catalogos/agencias": [{ id: 1, nombre: "Cusco Top" }],
  "/api/catalogos/formas-pago": [{ id: 1, nombre: "Efectivo" }],
  "/api/agencia-precios": [{ id: 1, agencia_id: 1, tour_id: 1, precio: 150, precio_usd: 42, activo: true }],
};

describe("VentaFormModal — autofill costo desde precio de agencia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((url: string) => {
      const body = CATALOGOS[url as keyof typeof CATALOGOS] ?? [];
      return Promise.resolve({ ok: true, json: async () => body } as any);
    }) as any;
  });

  it("prefills costo (PEN) when agencia + tour are both selected", async () => {
    render(<VentaFormModal />);
    fireEvent.click(screen.getByRole("button", { name: /registrar venta/i }));

    await waitFor(() => expect(screen.getByText("7 Lagunas")).toBeTruthy());

    const [tourSelect, , agenciaSelect] = screen.getAllByRole("combobox");
    fireEvent.change(tourSelect, { target: { value: "1" } });
    fireEvent.change(agenciaSelect, { target: { value: "1" } });

    await waitFor(() => {
      const costoInput = screen.getByLabelText("Costo proveedor") as HTMLInputElement;
      expect(costoInput.value).toBe("150");
    });
  });
});
