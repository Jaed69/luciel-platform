// apps/tours/web/tests/feedback-button.test.tsx
// Global floating button that opens the ticket/feedback form modal (D-28).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ventas",
}));
vi.mock("../src/components/Toast", () => ({
  showToast: vi.fn(),
}));

const { showToast } = await import("../src/components/Toast");
const { FeedbackButton } = await import("../src/components/FeedbackButton");

const OK_RESPONSE = { ok: true, status: 201, json: async () => ({ id: 1 }) } as any;

describe("FeedbackButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue(OK_RESPONSE);
  });

  it("renders a floating trigger, closed by default", () => {
    render(<FeedbackButton />);
    expect(screen.getByRole("button", { name: /feedback|solicitud|reportar/i })).toBeTruthy();
    expect(screen.queryByLabelText("Título")).toBeNull();
  });

  it("opens the form modal on click, with título/descripción/tipo fields", () => {
    render(<FeedbackButton />);
    fireEvent.click(screen.getByRole("button", { name: /feedback|solicitud|reportar/i }));
    expect(screen.getByLabelText("Título")).toBeTruthy();
    expect(screen.getByLabelText("Descripción")).toBeTruthy();
    expect(screen.getByLabelText("Tipo")).toBeTruthy();
  });

  it("submits with pagina_origen captured from the current path, and shows success toast", async () => {
    render(<FeedbackButton />);
    fireEvent.click(screen.getByRole("button", { name: /feedback|solicitud|reportar/i }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Botón roto" } });
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "No responde al click" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/solicitudes",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            titulo: "Botón roto",
            descripcion: "No responde al click",
            tipo: "bug",
            prioridad: "media",
            pagina_origen: "/ventas",
          }),
        }),
      );
    });
    expect(showToast).toHaveBeenCalledWith("success", expect.any(String));
  });
});
