// apps/tours/web/tests/tipos-tour.test.tsx
// /catalogos/tours — dedicated tab (D-29), mirrors ComisionesTab's early-return pattern.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TiposTourTab } from "../src/app/(app)/catalogos/_components/TiposTourTab";

type TipoTourRow = {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tiempo: string | null;
  precio_default: number | null;
  precio_default_usd: number | null;
  moneda_default: string;
  activo: boolean;
};

const MOCK_TOURS: TipoTourRow[] = [
  {
    id: 1, codigo: "T-7LAGUNAS", nombre: "7 Lagunas", descripcion: null, tiempo: "Full day",
    precio_default: 150, precio_default_usd: 42, moneda_default: "PEN", activo: true,
  },
];

vi.mock("../src/components/Toast", () => ({
  showToast: vi.fn(),
}));

describe("TiposTourTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) });
  });

  it("renders rows with nombre/tiempo/precio", () => {
    render(<TiposTourTab tours={MOCK_TOURS} tabs={["agencias", "tours", "comisiones"]} />);
    expect(screen.getByText("7 Lagunas")).toBeTruthy();
    expect(screen.getByText("Full day")).toBeTruthy();
  });

  it("opens create modal with codigo/nombre/descripcion/tiempo/precio fields", () => {
    render(<TiposTourTab tours={MOCK_TOURS} tabs={["agencias", "tours", "comisiones"]} />);
    fireEvent.click(screen.getByRole("button", { name: /nuevo tipo de tour/i }));
    expect(screen.getByLabelText("Código")).toBeTruthy();
    expect(screen.getByLabelText("Nombre")).toBeTruthy();
    expect(screen.getByLabelText("Tiempo")).toBeTruthy();
    expect(screen.getByLabelText("Precio (PEN)")).toBeTruthy();
    expect(screen.getByLabelText("Precio (USD)")).toBeTruthy();
  });

  it("submits create with all fields to /api/tours", async () => {
    render(<TiposTourTab tours={[]} tabs={["agencias", "tours", "comisiones"]} />);
    fireEvent.click(screen.getByRole("button", { name: /nuevo tipo de tour/i }));
    fireEvent.change(screen.getByLabelText("Código"), { target: { value: "T-NEW" } });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Nuevo Tour" } });
    fireEvent.change(screen.getByLabelText("Tiempo"), { target: { value: "2 horas" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/tours",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
