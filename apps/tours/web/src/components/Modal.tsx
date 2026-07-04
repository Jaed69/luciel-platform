"use client";
import { ReactNode, useEffect } from "react";

export function Modal({
  open,
  onClose,
  children,
  maxW = "md",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxW?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  const max = maxW === "sm" ? "max-w-[480px]" : maxW === "lg" ? "max-w-[768px]" : "max-w-[640px]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso-wine/50" onClick={onClose}>
      <div
        className={`bg-canvas rounded-xl shadow-lg p-6 w-full ${max} border border-gold/30`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}