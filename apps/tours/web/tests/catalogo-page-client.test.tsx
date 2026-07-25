// apps/tours/web/tests/catalogo-page-client.test.tsx
// CatalogoPageClient — Eliminar action, monedas hard-delete copy, agencias
// estado-operativo badge, vendedores read-only UX (icon + usuario_activo col).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CatalogoPageClient } from "../src/app/(app)/catalogos/[entidad]/_components/CatalogoPageClient";

vi.mock("../src/components/Toast", () => ({ showToast: vi.fn() }));

const AGENCIAS = [
  { id: 1, codigo: "AG-001", nombre: "Cusco Top", activo: true, estado: "operativa" },
  { id: 2, codigo: "AG-002", nombre: "Andes Travel", activo: true, estado: "sin_tours_vinculados" },
];

const MONEDAS = [{ id: 1, codigo: "PEN", nombre: "Sol", activo: true }];

const VENDEDORES = [
  { id: 1, codigo: "V-001", nombre: "Juan Perez", activo: true, usuario_activo: true },
  { id: 2, codigo: "V-002", nombre: "Legacy Vendedor", activo: true, usuario_activo: null },
];

describe("CatalogoPageClient", () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    // @ts-expect-error jsdom doesn't implement reload
    delete window.location;
    // @ts-expect-error minimal stub
    window.location = { reload: vi.fn() };
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it("agencias: shows Operativa / Sin tours vinculados badges", () => {
    render(<CatalogoPageClient data={AGENCIAS} entidad="agencias" label="agencia" />);
    expect(screen.getByText("Operativa")).toBeTruthy();
    expect(screen.getByText("Sin tours vinculados")).toBeTruthy();
  });

  it("agencias: Eliminar shows reversible confirm copy and calls DELETE", async () => {
    render(<CatalogoPageClient data={AGENCIAS} entidad="agencias" label="agencia" />);
    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar" })[0]);
    expect(confirmSpy).toHaveBeenCalledWith("¿Desactivar Cusco Top? Podrás restaurarlo luego.");
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/catalogos/agencias/1", { method: "DELETE" });
    });
  });

  it("monedas: hides Estado column and Eliminar shows permanent confirm copy", async () => {
    render(<CatalogoPageClient data={MONEDAS} entidad="monedas" label="moneda" />);
    expect(screen.queryByText("Activo")).toBeFalsy();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(confirmSpy).toHaveBeenCalledWith("Esta acción es permanente y no se puede deshacer.");
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/catalogos/monedas/1", { method: "DELETE" });
    });
  });

  it("vendedores: is read-only — no Eliminar/Editar, shows lock icon and explanatory copy", () => {
    render(<CatalogoPageClient data={VENDEDORES} entidad="vendedores" label="vendedor" />);
    expect(screen.getByText("Los vendedores se gestionan desde Usuarios (rol vendedor).")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Eliminar" })).toBeFalsy();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeFalsy();
    expect(screen.getAllByTitle("Gestionado desde Usuarios").length).toBe(2);
  });

  it("vendedores: renders usuario_activo Estado column, '—' for legacy unlinked rows", () => {
    render(<CatalogoPageClient data={VENDEDORES} entidad="vendedores" label="vendedor" />);
    expect(screen.getByText("Activo")).toBeTruthy();
    expect(screen.getByTitle("Sin usuario vinculado")).toBeTruthy();
  });
});
