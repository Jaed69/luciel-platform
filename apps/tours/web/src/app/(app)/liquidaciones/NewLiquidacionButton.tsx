"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { NewLiquidacionModal } from "./NewLiquidacionModal";

export function NewLiquidacionButton({ tipoServicio = "tour" }: { tipoServicio?: "tour" | "traslado" }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        {tipoServicio === "traslado" ? "Nueva liquidación de traslados" : "Nueva liquidación"}
      </Button>
      <NewLiquidacionModal
        open={open}
        tipoServicio={tipoServicio}
        onClose={() => setOpen(false)}
        onCreated={() => router.refresh()}
      />
    </>
  );
}
