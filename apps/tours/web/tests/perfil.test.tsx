// apps/tours/web/tests/perfil.test.tsx
// Plan 02.1.1-02 Task 3 — /perfil PasswordForm behavior.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PasswordForm } from "../src/app/(app)/perfil/PasswordForm";

// Mock showToast so its calls can be inspected without the Toast singleton wiring.
vi.mock("../src/components/Toast", () => ({
  showToast: vi.fn(),
}));

const { showToast } = await import("../src/components/Toast");

const OK_RESPONSE = { ok: true, status: 200, json: async () => ({}) } as any;
const UNAUTHORIZED = { ok: false, status: 401, json: async () => ({}) } as any;

describe("PasswordForm (perfil)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 3 password inputs + submit button", () => {
    render(<PasswordForm />);
    expect(screen.getByLabelText("Contraseña actual")).toBeTruthy();
    expect(screen.getByLabelText("Nueva contraseña")).toBeTruthy();
    expect(screen.getByLabelText("Confirmar nueva contraseña")).toBeTruthy();
    expect(screen.getByRole("button", { name: /cambiar contraseña/i })).toBeTruthy();
  });

  it("shows inline error when new password below 8 chars", async () => {
    render(<PasswordForm />);
    fireEvent.change(screen.getByLabelText("Contraseña actual"), { target: { value: "old" } });
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: /cambiar contraseña/i }));
    await waitFor(() => {
      expect(screen.getByText(/al menos 8 caracteres/i)).toBeTruthy();
    });
  });

  it("shows inline error when confirm does not match new", async () => {
    render(<PasswordForm />);
    fireEvent.change(screen.getByLabelText("Contraseña actual"), { target: { value: "old" } });
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "long-enough" } });
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), { target: { value: "different-stuff" } });
    fireEvent.click(screen.getByRole("button", { name: /cambiar contraseña/i }));
    await waitFor(() => {
      expect(screen.getByText(/no coinciden/i)).toBeTruthy();
    });
  });

  it("calls PUT /api/usuarios/me/password with correct body on valid submit and toasts success", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(OK_RESPONSE);
    (globalThis as any).fetch = fetchSpy;
    render(<PasswordForm />);
    fireEvent.change(screen.getByLabelText("Contraseña actual"), { target: { value: "currentpass" } });
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "newpass123" } });
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), { target: { value: "newpass123" } });
    fireEvent.click(screen.getByRole("button", { name: /cambiar contraseña/i }));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("/api/usuarios/me/password");
      expect(init.method).toBe("PUT");
      expect(JSON.parse(init.body)).toEqual({ current_password: "currentpass", new_password: "newpass123" });
    });
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("success", expect.stringMatching(/actualizada/i));
    });
  });

  it("toasts 'Contraseña actual incorrecta' on 401", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(UNAUTHORIZED);
    (globalThis as any).fetch = fetchSpy;
    render(<PasswordForm />);
    fireEvent.change(screen.getByLabelText("Contraseña actual"), { target: { value: "wrong" } });
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "newpass123" } });
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), { target: { value: "newpass123" } });
    fireEvent.click(screen.getByRole("button", { name: /cambiar contraseña/i }));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("error", expect.stringMatching(/actual incorrecta/i));
    });
  });
});