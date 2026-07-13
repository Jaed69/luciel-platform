"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/Button";

export function LogoutButton() {
  return (
    <Button
      variant="outlined"
      size="sm"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Cerrar sesión
    </Button>
  );
}
