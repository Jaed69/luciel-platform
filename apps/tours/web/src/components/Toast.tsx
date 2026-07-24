"use client";
import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "warning";
type ToastOptions = { actionLabel?: string; durationMs?: number; onAction?: () => void };
type ToastState = { type: ToastType; message: string; options?: ToastOptions } | null;

let externalSetter: ((t: ToastState) => void) | null = null;

// D-33 — third `options` arg is optional so existing 2-arg call sites
// (`showToast("success", "…")`) keep working unchanged.
export function showToast(type: ToastType, message: string, options?: ToastOptions) {
  externalSetter?.({ type, message, options });
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
    const duration = toast.options?.durationMs ?? durations[toast.type];
    const t = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div
      role={roles[toast.type]}
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-canvas rounded-lg shadow-lg p-4 max-w-[640px] border-l-4 ${variants[toast.type]} font-nunito text-text-espresso flex items-center gap-4`}
    >
      <span>{toast.message}</span>
      {toast.options?.actionLabel && (
        <button
          type="button"
          className="text-primary font-semibold underline underline-offset-4 shrink-0"
          onClick={() => {
            toast.options?.onAction?.();
            setToast(null);
          }}
        >
          {toast.options.actionLabel}
        </button>
      )}
    </div>
  );
}
