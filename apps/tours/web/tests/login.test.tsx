// apps/tours/web/tests/login.test.tsx
// Login form accepts username or email as the identifier field.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next-auth/react", () => ({
  signIn: vi.fn().mockResolvedValue({ error: null }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { signIn } = await import("next-auth/react");
const { default: LoginPage } = await import("../src/app/login/page");

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a single identifier field labeled 'Correo o usuario', not 'Correo'", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText("Correo o usuario")).toBeTruthy();
    expect(screen.queryByLabelText("Correo")).toBeNull();
  });

  it("submits the identifier field value as `identifier`, not `email`", async () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Correo o usuario"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));
    await vi.waitFor(() => {
      expect(signIn).toHaveBeenCalledWith(
        "credentials",
        expect.objectContaining({ identifier: "admin", password: "secret" }),
      );
    });
  });
});
