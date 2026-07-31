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
    { id: 1, nombre: "Cusco Top", tipo: "proveedor_tour" },
    { id: 5, nombre: "Transportes Andean", tipo: "proveedor_transporte" },
  ],
  "/api/catalogos/formas-pago": [{ id: 2, nombre: "Yape" }, { id: 1, nombre: "Efectivo" }],
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

async function abrirFormulario(props: { role?: string; vendedorId?: string } = { role: "admin" }) {
  render(<TrasladoFormModal {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Registrar traslado" }));
  await waitFor(() => expect(screen.getByLabelText(/Proveedor del transporte/)).toBeTruthy());
}

describe("TrasladoFormModal", () => {
  it("sólo ofrece proveedores de transporte, nunca agencias de tours", async () => {
    await abrirFormulario();
    const proveedor = screen.getByLabelText(/Proveedor del transporte/) as HTMLSelectElement;
    const opts = Array.from(proveedor.options).map((o) => o.text);
    expect(opts).toContain("Transportes Andean");
    expect(opts).not.toContain("Cusco Top");
  });

  it("no pide hotel: el hotel somos nosotros", async () => {
    await abrirFormulario();
    expect(screen.queryByLabelText(/Hotel/)).toBeNull();
  });

  it("distingue la fecha del traslado de la fecha de cobro", async () => {
    await abrirFormulario();
    expect(screen.getByLabelText(/Fecha del traslado/)).toBeTruthy();
    expect(screen.getByLabelText(/Fecha de cobro/)).toBeTruthy();
  });

  it("la fecha de cobro sigue a la del traslado hasta que se la toca a mano", async () => {
    await abrirFormulario();
    const traslado = screen.getByLabelText(/Fecha del traslado/) as HTMLInputElement;
    const cobro = screen.getByLabelText(/Fecha de cobro/) as HTMLInputElement;

    fireEvent.change(traslado, { target: { value: "2026-07-06" } });
    expect(cobro.value).toBe("2026-07-06");

    // Una vez editada a mano, deja de arrastrarse.
    fireEvent.change(cobro, { target: { value: "2026-07-10" } });
    fireEvent.change(traslado, { target: { value: "2026-07-08" } });
    expect(cobro.value).toBe("2026-07-10");
  });

  it("previsualiza la ganancia como precio − costo", async () => {
    await abrirFormulario();
    fireEvent.change(screen.getByLabelText(/Precio cobrado al huésped/), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText(/Costo del proveedor/), { target: { value: "60" } });

    expect(screen.getByText(/Ganancia/)).toBeTruthy();
    expect(screen.getByText(/40\.00/)).toBeTruthy();
  });

  it("preselecciona Efectivo como método de pago", async () => {
    await abrirFormulario();
    expect((screen.getByLabelText(/Método de pago/) as HTMLSelectElement).value).toBe("1");
  });

  it("resuelve el vendedor solo cuando la cuenta tiene uno vinculado", async () => {
    await abrirFormulario({ role: "admin", vendedorId: "1" });
    // Sin selector: se muestra el nombre y ya.
    expect(screen.queryByRole("combobox", { name: /Vendedor/ })).toBeNull();
    expect(screen.getByText("Vendedor demo")).toBeTruthy();
  });

  it("bloquea el envío si el costo supera al precio cobrado", async () => {
    await abrirFormulario();
    fireEvent.change(screen.getByLabelText(/Precio cobrado al huésped/), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText(/Costo del proveedor/), { target: { value: "80" } });

    expect(screen.getByText(/no puede superar el precio/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Guardar traslado/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("envía el traslado a /api/traslados con los campos operativos y ambas fechas", async () => {
    await abrirFormulario({ role: "admin", vendedorId: "1" });
    fireEvent.change(screen.getByLabelText(/Nombre del huésped/), { target: { value: "Ana Pérez" } });
    fireEvent.change(screen.getByLabelText(/habitación/), { target: { value: "204" } });
    fireEvent.change(screen.getByLabelText(/Destino/), { target: { value: "Aeropuerto" } });
    fireEvent.change(screen.getByLabelText(/Hora del traslado/), { target: { value: "08:30" } });
    fireEvent.change(screen.getByLabelText(/Fecha del traslado/), { target: { value: "2026-07-06" } });
    fireEvent.change(screen.getByLabelText(/Fecha de cobro/), { target: { value: "2026-07-04" } });
    fireEvent.change(screen.getByLabelText(/Proveedor del transporte/), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/Precio cobrado al huésped/), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText(/Costo del proveedor/), { target: { value: "60" } });

    fireEvent.click(screen.getByRole("button", { name: /Guardar traslado/ }));

    await waitFor(() => {
      const post = (fetch as any).mock.calls.find((c: any[]) => c[1]?.method === "POST");
      expect(post).toBeTruthy();
      expect(post[0]).toBe("/api/traslados");
      const body = JSON.parse(post[1].body);
      expect(body).toMatchObject({
        agencia_id: 5,
        vendedor_id: 1,
        forma_pago_id: 1,  // Efectivo por defecto
        destino: "Aeropuerto",
        nombre_huesped: "Ana Pérez",
        numero_habitacion: "204",
        hora: "08:30",
        fecha: "2026-07-04",           // cobro
        fecha_servicio: "2026-07-06",  // traslado
        monto: 100,
        costo: 60,
      });
      expect(body).not.toHaveProperty("hotel_id");
    });
  });
});

describe("VentaTable con traslados", () => {
  const traslado = {
    id: 1, tour_id: 9, vendedor_id: 1, agencia_id: 5, forma_pago_id: 1,
    moneda: "PEN" as const, monto: 100, costo: 60,
    fecha: "2026-07-04", fecha_servicio: "2026-07-06",
    asiento_id: 1, liquidacion_id: null,
    tipo_servicio: "traslado" as const,
    destino: "Aeropuerto", nombre_huesped: "Ana Pérez", numero_habitacion: "204", hora: "08:30",
  };

  it("muestra destino, huésped y habitación", () => {
    render(<VentaTable ventas={[traslado]} />);
    expect(screen.getByText("Traslado")).toBeTruthy();
    expect(screen.getByText(/Aeropuerto/)).toBeTruthy();
    expect(screen.getByText(/Ana Pérez/)).toBeTruthy();
    expect(screen.getByText(/hab\. 204/)).toBeTruthy();
  });

  it("muestra las dos fechas en columnas separadas", () => {
    render(<VentaTable ventas={[traslado]} />);
    expect(screen.getByText("Fecha de cobro")).toBeTruthy();
    expect(screen.getByText("Fecha del servicio")).toBeTruthy();
    expect(screen.getByText("4/7/2026")).toBeTruthy();   // cobro
    expect(screen.getByText("6/7/2026")).toBeTruthy();   // servicio
    expect(screen.getByText(/08:30/)).toBeTruthy();
  });

  it("un tour no tiene fecha de servicio propia", () => {
    render(<VentaTable ventas={[{ ...traslado, tipo_servicio: "tour", fecha_servicio: null, destino: null }]} />);
    expect(screen.getByText("Tour")).toBeTruthy();
    expect(screen.getByText("T-9")).toBeTruthy();
  });
});
