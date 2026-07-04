"use client";
import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "warning";
type ToastState = { type: ToastType; message: string } | null;

let externalSetter: ((t: ToastState) => void) | null = null;

export function showToast(type: ToastType, message: string) {
  externalSetter?.({ type, message });
}

const variants: Record<ToastType, string> = {
  success: "border-l-wine-light-tint",
  error: "border-l-chili-red",
  warning: "border-l-amber-warning",
};

const roles: Record<ToastType, "alert" | "status"> = {
  success: "status",
  error: "alert",
  warning: "alert",
};

const durations: Record<ToastType, number> = { success: 5000, error: 8000, warning: 6000 };

export function Toast() {
  const [toast, setToast] = useState<ToastState>(null);
  useEffect(() => {
    externalSetter = setToast;
    return () => { externalSetter = null; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), durations[toast.type]);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div
      role={roles[toast.type]}
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-canvas rounded-lg shadow-lg p-4 max-w-[640px] border-l-4 ${variants[toast.type]} font-nunito text-text-espresso`}
    >
      {toast.message}
    </div>
  );
}