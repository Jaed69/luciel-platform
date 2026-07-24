// apps/tours/web/tests/venta-form-precio.test.tsx
// VentaFormModal — D-33 tour-agencia search combobox, motivo-on-edit guard,
// duplicate warning, and undo-toast wiring.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { VentaFormModal } from "../src/app/(app)/ventas/components/VentaFormModal";

const showToastMock = vi.fn();
vi.mock("../src/components/Toast", () => ({ showToast: (...args: unknown[]) => showToastMock(...args) }));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const CATALOGOS: Record<string, any> = {
  "/api/catalogos/vendedores": [{ id: 1, nombre: "Vendedor demo" }],
  "/api/catalogos/agencias": [{ id: 1, nombre: "Cusco Top" }, { id: 2, nombre: "Andes Travel" }],
  "/api/catalogos/formas-pago": [{ id: 1, nombre: "Efectivo" }],
};

const DEFAULT_AGENCIA_PRECIOS = [
  { id: 1, agencia_id: 1, tour_id: 1, precio: 150, precio_usd: 42, activo: true },
];

const SINGLE_AGENCIA_RESULT = [
  { tour_id: 1, nombre: "7 Lagunas", agencia_id: 1, agencia_nombre: "Cusco Top", precio: 150, precio_usd: 42, es_reciente: true },
];

const MULTI_AGENCIA_PRECIOS = [
  { id: 1, agencia_id: 1, tour_id: 2, precio: 100, precio_usd: 28, activo: true },
  { id: 2, agencia_id: 2, tour_id: 2, precio: 90, precio_usd: 25, activo: true },
];

function mockFetch(overrides: Record<string, any> = {}, tourSearchResult: any[] = SINGLE_AGENCIA_RESULT) {
  global.fetch = vi.fn((url: string) => {
    const u = String(url);
    if (u.startsWith("/api/ventas/tour-search")) {
      return Promise.resolve({ ok: true, json: async () => tourSearchResult } as any);
    }
    if (u.startsWith("/api/ventas/check-duplicado")) {
      return Promise.resolve({ ok: true, json: async () => (overrides.duplicado ?? { duplicado: false, venta_id: null }) } as any);
    }
    if (u.startsWith("/api/ventas?")) {
      return Promise.resolve({ ok: true, json: async () => [] } as any);
    }
    if (u === "/api/ventas" && overrides.ventasPost) {
      return Promise.resolve(overrides.ventasPost as any);
    }
    if (u === "/api/agencia-precios") {
      return Promise.resolve({ ok: true, json: async () => (overrides.agenciaPrecios ?? DEFAULT_AGENCIA_PRECIOS) } as any);
    }
    for (const key of Object.keys(CATALOGOS)) {
      if (u.startsWith(key)) return Promise.resolve({ ok: true, json: async () => CATALOGOS[key] } as any);
    }
    return Promise.resolve({ ok: true, json: async () => [] } as any);
  }) as any;
}

function submitButton() {
  // Two "Registrar venta" buttons exist once the modal is open: the trigger
  // (still mounted behind it) and the in-form submit — the submit is last.
  const matches = screen.getAllByRole("button", { name: /^registrar venta$/i });
  return matches[matches.length - 1];
}

// Forma de pago is still a required native <select> — pick it so the
// browser's own constraint validation doesn't swallow the submit before our
// handler (motivo/duplicado checks) ever runs.
function pickFormaPago() {
  fireEvent.change(screen.getByLabelText("Forma de pago"), { target: { value: "1" } });
}

async function openModalAndSearch(query = "7") {
  render(<VentaFormModal role="vendedor" vendedorId="1" />);
  fireEvent.click(submitButton());
  const input = await screen.findByPlaceholderText("Busca un tour…");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: query } });
  await waitFor(() => expect(screen.getByText(/7 Lagunas|Valle Sagrado/)).toBeTruthy());
  return input;
}

describe("VentaFormModal — TourAgenciaSearch autofill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch();
  });

  it("auto-selects the single resolved agencia and prefills costo/monto", async () => {
    const input = await openModalAndSearch();
    fireEvent.mouseDown(screen.getByText("7 Lagunas"));

    await waitFor(() => {
      expect(screen.getByLabelText("Costo proveedor")).toHaveTextContent("150");
    });
    expect(screen.getByLabelText("Monto")).toHaveTextContent("150");
    expect((input as HTMLInputElement).value).toBe("7 Lagunas");
    // No alternate-agencia dropdown when the tour only has one price agreement.
    expect(screen.queryByText("Andes Travel")).toBeNull();
  });

  it("shows an editable agencia dropdown, preselected, when the tour has 2+ agencias", async () => {
    mockFetch({ agenciaPrecios: MULTI_AGENCIA_PRECIOS }, [
      { tour_id: 2, nombre: "Valle Sagrado", agencia_id: 1, agencia_nombre: "Cusco Top", precio: 100, precio_usd: 28, es_reciente: false },
    ]);
    await openModalAndSearch("Valle");
    fireEvent.mouseDown(screen.getByText("Valle Sagrado"));

    const select = await screen.findByDisplayValue("Cusco Top");
    expect(within(select.closest("label")!).getByText("Andes Travel")).toBeTruthy();
  });
});

describe("VentaFormModal — motivo required on edited costo/monto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch();
  });

  it("blocks submit with an error toast until a motivo is chosen for a changed monto", async () => {
    await openModalAndSearch();
    fireEvent.mouseDown(screen.getByText("7 Lagunas"));
    await waitFor(() => expect(screen.getByLabelText("Monto")).toHaveTextContent("150"));

    fireEvent.click(screen.getByRole("button", { name: /editar monto/i }));
    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "180" } });

    const motivoSelect = await screen.findByLabelText("Motivo del cambio de monto");
    expect(motivoSelect).toBeTruthy();

    pickFormaPago();
    fireEvent.click(submitButton());
    await waitFor(() => expect(showToastMock).toHaveBeenCalledWith("error", expect.stringContaining("motivo")));
  });
});

describe("VentaFormModal — duplicado warning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an inline warning instead of submitting when check-duplicado reports a match", async () => {
    mockFetch({ duplicado: { duplicado: true, venta_id: 99 } });
    await openModalAndSearch();
    fireEvent.mouseDown(screen.getByText("7 Lagunas"));
    await waitFor(() => expect(screen.getByLabelText("Monto")).toHaveTextContent("150"));

    pickFormaPago();
    fireEvent.click(submitButton());

    await waitFor(() => expect(screen.getByText(/registro duplicado/i)).toBeTruthy());
    expect(screen.getByRole("button", { name: /continuar de todas formas/i })).toBeTruthy();
  });
});

describe("VentaFormModal — undo toast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wires the success toast's Deshacer action to DELETE /api/ventas/{id}/undo", async () => {
    mockFetch({
      duplicado: { duplicado: false, venta_id: null },
      ventasPost: { ok: true, json: async () => ({ asiento_id: 5, tour_servicio_id: 42 }) },
    });
    await openModalAndSearch();
    fireEvent.mouseDown(screen.getByText("7 Lagunas"));
    await waitFor(() => expect(screen.getByLabelText("Monto")).toHaveTextContent("150"));

    pickFormaPago();
    fireEvent.click(submitButton());

    await waitFor(() => expect(showToastMock).toHaveBeenCalledWith(
      "success",
      expect.stringContaining("Asiento"),
      expect.objectContaining({ actionLabel: "Deshacer" }),
    ));

    const call = showToastMock.mock.calls.find((c) => c[2]?.actionLabel === "Deshacer");
    const deleteSpy = vi.fn(() => Promise.resolve({ ok: true }));
    const originalFetch = global.fetch;
    global.fetch = ((url: string, opts?: any) => {
      if (String(url) === "/api/ventas/42/undo" && opts?.method === "DELETE") return deleteSpy();
      return (originalFetch as any)(url, opts);
    }) as any;

    await call![2].onAction();
    expect(deleteSpy).toHaveBeenCalled();
  });
});
