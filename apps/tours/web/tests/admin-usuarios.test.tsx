// apps/tours/web/tests/admin-usuarios.test.tsx
// Plan 02.1.1-02 Task 3 — /admin/usuarios UsuariosTable render + actions.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { UsuariosTable } from "../src/app/(app)/admin/usuarios/UsuariosTable";

type UsuarioRow = {
  id: number;
  email: string;
  username: string;
  rol: string;
  activo: boolean;
  ultimo_acceso: string | null;
};

const MOCK_USUARIOS: UsuarioRow[] = [
  { id: 1, email: "admin@tours.luciel.dev", username: "admin", rol: "admin", activo: true, ultimo_acceso: null },
  { id: 2, email: "vendedor@tours.luciel.dev", username: "vendedor1", rol: "vendedor", activo: true, ultimo_acceso: null },
  { id: 3, email: "inactive@tours.luciel.dev", username: "inactive", rol: "vendedor", activo: false, ultimo_acceso: null },
];

vi.mock("../src/components/Toast", () => ({
  showToast: vi.fn(),
}));

describe("UsuariosTable (admin/usuarios)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders rows with email + rol + actions", () => {
    render(<UsuariosTable usuarios={MOCK_USUARIOS} currentUserId={1} />);
    expect(screen.getByText("admin@tours.luciel.dev")).toBeTruthy();
    expect(screen.getByText("vendedor@tours.luciel.dev")).toBeTruthy();
    expect(screen.getByText("inactive@tours.luciel.dev")).toBeTruthy();
    // Editar links — 3 rows
    expect(screen.getAllByRole("button", { name: /editar/i }).length).toBeGreaterThanOrEqual(3);
  });

  it("Eliminar is visually disabled (cursor-not-allowed) for self (currentUserId === row.id)", () => {
    render(<UsuariosTable usuarios={MOCK_USUARIOS} currentUserId={1} />);
    // Find the disabled Eliminar — it has the cursor-not-allowed class
    const eliminarCells = screen.getAllByText(/eliminar/i);
    const selfEliminar = eliminarCells.find((el) => el.className.includes("cursor-not-allowed"));
    expect(selfEliminar).toBeTruthy();
  });

  it("Eliminar is visually disabled for the only active admin (last-admin guard)", () => {
    render(<UsuariosTable usuarios={MOCK_USUARIOS} currentUserId={99} />);
    // Only 1 admin (id=1) → its Eliminar should be disabled even when current user is id=99 (not self)
    const eliminarCells = screen.getAllByText(/eliminar/i);
    const lastAdminEliminar = eliminarCells.find((el) => el.className.includes("cursor-not-allowed"));
    expect(lastAdminEliminar).toBeTruthy();
  });

  it("Eliminar is disabled for inactive rows", () => {
    render(<UsuariosTable usuarios={MOCK_USUARIOS} currentUserId={99} />);
    // id=3 is inactive vendedor → Eliminar disabled
    const eliminarCells = screen.getAllByText(/eliminar/i);
    const disabledCount = eliminarCells.filter((el) => el.className.includes("cursor-not-allowed")).length;
    // Should have 2 disabled: admin (last-admin) + inactive row
    expect(disabledCount).toBeGreaterThanOrEqual(2);
  });
});