// apps/tours/web/tests/liquidacion-acciones.test.tsx
// Las acciones de la liquidación deben pegarle a los Route Handlers de Next
// (/api/liquidaciones/...), que son los que adjuntan el bearer token. Antes
// llamaban a lib/api::apiFetch — código de servidor (getServerSession) apuntando
// a la URL interna de FastAPI — desde un componente "use client", así que
// cerrar/reabrir fallaba siempre en el navegador.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { CloseModal } from "../src/app/(app)/liquidaciones/[id]/components/CloseModal";
import { ReopenModal } from "../src/app/(app)/liquidaciones/[id]/components/ReopenModal";
import { CancelModal } from "../src/app/(app)/liquidaciones/[id]/components/CancelModal";

const liq = {
  id: 7,
  codigo: "LIQ-2026-001",
  fecha_desde: "2026-07-01",
  fecha_hasta: "2026-07-31",
  estado: "abierta" as const,
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
});

describe("Acciones de liquidación", () => {
  it("Cerrar → POST /api/liquidaciones/{id}/close", async () => {
    render(<CloseModal liquidacion={liq} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar liquidación" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cierre" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/liquidaciones/7/close", { method: "POST" }),
    );
  });

  it("Reabrir → POST /api/liquidaciones/{id}/reopen", async () => {
    render(<ReopenModal liquidacion={{ ...liq, estado: "cerrada" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Reabrir liquidación" }));
    const confirmar = screen.getAllByRole("button", { name: "Reabrir liquidación" })[1];
    fireEvent.click(confirmar);
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/liquidaciones/7/reopen", { method: "POST" }),
    );
  });

  it("Anular → DELETE /api/liquidaciones/{id}", async () => {
    render(<CancelModal liquidacion={liq} />);
    fireEvent.click(screen.getByRole("button", { name: "Anular liquidación" }));
    const confirmar = screen.getAllByRole("button", { name: "Anular liquidación" })[1];
    fireEvent.click(confirmar);
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/liquidaciones/7", { method: "DELETE" }),
    );
  });

  it("muestra el detalle del error del backend cuando el cierre es rechazado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              detail: { message: "No se puede cerrar la liquidación: faltan datos", errors: [{ tour_id: 3, problema: "costo_faltante" }] },
            }),
            { status: 422 },
          ),
      ),
    );
    render(<CloseModal liquidacion={liq} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar liquidación" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cierre" }));
    expect(await screen.findByText(/faltan datos.*T-3.*costo_faltante/)).toBeTruthy();
  });
});
