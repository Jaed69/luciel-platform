// apps/tours/web/tests/solicitudes.test.tsx
// /solicitudes SolicitudesTable — read-only for non-admin, management actions for admin.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SolicitudesTable } from "../src/app/(app)/solicitudes/SolicitudesTable";

type SolicitudRow = {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: string;
  prioridad: string;
  estado: string;
  pagina_origen: string | null;
  creado_por: number;
  creado_en: string;
  respuesta: string | null;
  resuelto_por: number | null;
  resuelto_en: string | null;
};

const MOCK_SOLICITUDES: SolicitudRow[] = [
  {
    id: 1, titulo: "Botón roto", descripcion: "x", tipo: "bug", prioridad: "alta", estado: "abierto",
    pagina_origen: "/ventas", creado_por: 2, creado_en: "2026-07-23T00:00:00Z",
    respuesta: null, resuelto_por: null, resuelto_en: null,
  },
];

vi.mock("../src/components/Toast", () => ({
  showToast: vi.fn(),
}));

describe("SolicitudesTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
  });

  it("renders ticket rows with título/tipo/estado", () => {
    render(<SolicitudesTable solicitudes={MOCK_SOLICITUDES} isAdmin={false} />);
    expect(screen.getByText("Botón roto")).toBeTruthy();
    expect(screen.getByText("bug")).toBeTruthy();
  });

  it("does not show a Resolver action for non-admin", () => {
    render(<SolicitudesTable solicitudes={MOCK_SOLICITUDES} isAdmin={false} />);
    expect(screen.queryByRole("button", { name: /resolver/i })).toBeNull();
  });

  it("shows a Resolver action for admin that opens a resolution modal with estado + respuesta", () => {
    render(<SolicitudesTable solicitudes={MOCK_SOLICITUDES} isAdmin={true} />);
    fireEvent.click(screen.getByRole("button", { name: /resolver/i }));
    expect(screen.getByLabelText("Estado")).toBeTruthy();
    expect(screen.getByLabelText("Respuesta")).toBeTruthy();
  });

  it("admin resolving submits PUT with estado + respuesta", async () => {
    render(<SolicitudesTable solicitudes={MOCK_SOLICITUDES} isAdmin={true} />);
    fireEvent.click(screen.getByRole("button", { name: /resolver/i }));
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "resuelto" } });
    fireEvent.change(screen.getByLabelText("Respuesta"), { target: { value: "Ya se arregló" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/solicitudes/1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ estado: "resuelto", respuesta: "Ya se arregló" }),
        }),
      );
    });
  });
});
