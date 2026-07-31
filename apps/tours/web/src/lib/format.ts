// Client-safe formatters. Kept out of lib/api.ts on purpose: that module pulls
// in getServerSession/authOptions, so importing it from a "use client"
// component drags the whole NextAuth server stack into the browser bundle.
export function formatCurrency(monto: number, moneda: "PEN" | "USD"): string {
  const currency = moneda === "PEN" ? "PEN" : "USD";
  return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(monto);
}
