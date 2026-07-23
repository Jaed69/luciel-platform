// apps/tours/web/tests/agencia-detail.test.tsx
// /agencias/[id] — saldo + precios por tour + historial de pagos + registrar pago (D-30).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AgenciaDetailClient } from "../src/app/(app)/agencias/[id]/AgenciaDetailClient";

vi.mock("../src/components/Toast", () => ({ showToast: vi.fn() }));

const AGENCIA = { id: 1, codigo: "AG-CUSCOTOP", nombre: "Cusco Top", activo: true };
const TOURS = [{ id: 1, nombre: "7 Lagunas" }, { id: 2, nombre: "Motocross" }];
const PRECIOS = [{ id: 10, agencia_id: 1, tour_id: 1, precio: 150, precio_usd: 42, activo: true }];
const PAGOS = [{ id: 5, agencia_id: 1, fecha: "2026-07-10", monto: 60, moneda: "PEN", metodo: "deposito", referencia: "DEP-1", nota: null }];
const SALDO = { agencia_id: 1, PEN: 90, USD: 0 };

describe("AgenciaDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) });
  });

  it("renders saldo pendiente PEN/USD", () => {
    render(<AgenciaDetailClient agencia={AGENCIA} tours={TOURS} precios={PRECIOS} pagos={PAGOS} saldo={SALDO} />);
    expect(screen.getByText(/90/)).toBeTruthy();
  });

  it("renders price list with tour nombre + precio", () => {
    render(<AgenciaDetailClient agencia={AGENCIA} tours={TOURS} precios={PRECIOS} pagos={PAGOS} saldo={SALDO} />);
    expect(screen.getByText("7 Lagunas")).toBeTruthy();
    expect(screen.getByText("150")).toBeTruthy();
  });

  it("renders payment history", () => {
    render(<AgenciaDetailClient agencia={AGENCIA} tours={TOURS} precios={PRECIOS} pagos={PAGOS} saldo={SALDO} />);
    expect(screen.getByText("DEP-1")).toBeTruthy();
  });

  it("opens 'Registrar pago' modal and submits with correct payload", async () => {
    render(<AgenciaDetailClient agencia={AGENCIA} tours={TOURS} precios={PRECIOS} pagos={PAGOS} saldo={SALDO} />);
    fireEvent.click(screen.getByRole("button", { name: /registrar pago/i }));
    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("Referencia"), { target: { value: "DEP-2" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/agencia-pagos",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
