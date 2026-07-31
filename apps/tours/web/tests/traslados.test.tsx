// apps/tours/web/tests/traslados.test.tsx
// D-34 — alta de traslado desde /ventas y su presentación en la tabla.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("../src/components/Toast", () => ({ showToast: vi.fn(), Toast: () => null }));

import { TrasladoFormModal } from "../src/app/(app)/ventas/components/TrasladoFormModal";
import { VentaTable } from "../src/app/(app)/ventas/components/VentaTable";

const CATALOGOS: Record<string, unknown> = {
  "/api/catalogos/vendedores": [{ id: 1, nombre: "Vendedor demo" }],
  "/api/catalogos/agencias": [
    { id: 1, nombre: "Transportes Andean", tipo: "proveedor" },
    { id: 5, nombre: "Hotel Plaza", tipo: "hotel" },
  ],
  "/api/catalogos/formas-pago": [{ id: 1, nombre: "Efectivo" }],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ asiento_id: 1, tour_servicio_id: 1 }), { status: 201 });
      return new Response(JSON.stringify(CATALOGOS[url] ?? []), { status: 200 });
    }),
  );
});

async function abrirFormulario() {
  render(<TrasladoFormModal role="admin" />);
  fireEvent.click(screen.getByRole("button", { name: "Registrar traslado" }));
  await waitFor(() => expect(screen.getByLabelText(/Hotel/)).toBeTruthy());
}

describe("TrasladoFormModal", () => {
  it("separa hoteles de proveedores en sus respectivos selectores", async () => {
    await abrirFormulario();
    const hotel = screen.getByLabelText(/Hotel/) as HTMLSelectElement;
    const proveedor = screen.getByLabelText(/Proveedor del transporte/) as HTMLSelectElement;

    const opts = (s: HTMLSelectElement) => Array.from(s.options).map((o) => o.text);
    expect(opts(hotel)).toContain("Hotel Plaza");
    expect(opts(hotel)).not.toContain("Transportes Andean");
    expect(opts(proveedor)).toContain("Transportes Andean");
    expect(opts(proveedor)).not.toContain("Hotel Plaza");
  });

  it("previsualiza la comisión del hotel como precio − costo, sin pedirla como campo", async () => {
    await abrirFormulario();
    fireEvent.change(screen.getByLabelText(/Precio cobrado al huésped/), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText(/Costo del proveedor/), { target: { value: "60" } });

    expect(screen.getByText(/Comisión al hotel/)).toBeTruthy();
    expect(screen.getByText(/40\.00/)).toBeTruthy();
    // No debe existir un input para escribirla a mano.
    expect(screen.queryByLabelText(/Comisión al hotel/)).toBeNull();
  });

  it("bloquea el envío si el costo supera al precio cobrado", async () => {
    await abrirFormulario();
    fireEvent.change(screen.getByLabelText(/Precio cobrado al huésped/), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText(/Costo del proveedor/), { target: { value: "80" } });

    expect(screen.getByText(/no puede superar el precio/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Guardar traslado/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("envía el traslado a /api/traslados con los campos operativos", async () => {
    await abrirFormulario();
    fireEvent.change(screen.getByLabelText(/Nombre del huésped/), { target: { value: "Ana Pérez" } });
    fireEvent.change(screen.getByLabelText(/habitación/), { target: { value: "204" } });
    fireEvent.change(screen.getByLabelText(/Destino/), { target: { value: "Aeropuerto" } });
    fireEvent.change(screen.getByLabelText(/^Hora$/), { target: { value: "08:30" } });
    fireEvent.change(screen.getByLabelText(/Hotel/), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/Proveedor del transporte/), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/Vendedor/), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/Método de pago/), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/Precio cobrado al huésped/), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText(/Costo del proveedor/), { target: { value: "60" } });

    fireEvent.click(screen.getByRole("button", { name: /Guardar traslado/ }));

    await waitFor(() => {
      const post = (fetch as any).mock.calls.find((c: any[]) => c[1]?.method === "POST");
      expect(post).toBeTruthy();
      expect(post[0]).toBe("/api/traslados");
      const body = JSON.parse(post[1].body);
      expect(body).toMatchObject({
        hotel_id: 5,
        agencia_id: 1,
        destino: "Aeropuerto",
        nombre_huesped: "Ana Pérez",
        numero_habitacion: "204",
        hora: "08:30",
        monto: 100,
        costo: 60,
      });
      // La comisión la deriva el backend — el cliente no la manda.
      expect(body).not.toHaveProperty("comision_hotel");
    });
  });
});

describe("VentaTable con traslados", () => {
  const traslado = {
    id: 1, tour_id: 9, vendedor_id: 1, agencia_id: 1, forma_pago_id: 1,
    moneda: "PEN" as const, monto: 100, costo: 60, fecha: "2026-07-04",
    asiento_id: 1, liquidacion_id: null,
    tipo_servicio: "traslado" as const, hotel_id: 5, comision_hotel: 40,
    destino: "Aeropuerto", nombre_huesped: "Ana Pérez", numero_habitacion: "204", hora: "08:30",
  };

  it("muestra destino, huésped, habitación, hora y comisión del hotel", () => {
    render(<VentaTable ventas={[traslado]} />);
    expect(screen.getByText("Traslado")).toBeTruthy();
    expect(screen.getByText(/Aeropuerto/)).toBeTruthy();
    expect(screen.getByText(/Ana Pérez/)).toBeTruthy();
    expect(screen.getByText(/hab\. 204/)).toBeTruthy();
    expect(screen.getByText(/08:30/)).toBeTruthy();
    expect(screen.getByText(/40\.00/)).toBeTruthy();
  });

  it("un tour sigue mostrándose como tour y sin comisión de hotel", () => {
    render(<VentaTable ventas={[{ ...traslado, tipo_servicio: "tour", comision_hotel: null, destino: null }]} />);
    expect(screen.getByText("Tour")).toBeTruthy();
    expect(screen.getByText("T-9")).toBeTruthy();
  });
});
