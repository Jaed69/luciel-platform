// Shared reader for FastAPI error bodies as they arrive through the Next route
// handlers (api/_lib/proxy.ts passes `detail` through verbatim, so it can be a
// plain string, a {message, errors} object from the liquidación pre-check, or a
// Pydantic validation array).
export async function errorMessage(res: Response, fallback = "Ocurrió un error"): Promise<string> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    return `${fallback} (HTTP ${res.status})`;
  }
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail.map((d) => d?.msg).filter(Boolean);
    if (msgs.length > 0) return msgs.join(" · ");
  }
  if (detail && typeof detail === "object") {
    const base = detail.message ?? detail.mensaje;
    const errors = Array.isArray(detail.errors) ? detail.errors : [];
    const suffix = errors
      .map((e: any) => (e?.tour_id != null ? `T-${e.tour_id}: ${e.problema ?? "dato faltante"}` : e?.problema))
      .filter(Boolean)
      .join(" · ");
    if (base) return suffix ? `${base} — ${suffix}` : String(base);
    if (suffix) return suffix;
  }
  return `${fallback} (HTTP ${res.status})`;
}
