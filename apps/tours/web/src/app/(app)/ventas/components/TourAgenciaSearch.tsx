"use client";
import { forwardRef, useEffect, useRef, useState } from "react";

export type TourSearchRow = {
  tour_id: number;
  nombre: string;
  agencia_id: number | null;
  agencia_nombre: string | null;
  precio: number | null;
  precio_usd: number | null;
  es_reciente: boolean;
};

function formatPrecio(row: TourSearchRow): string {
  if (row.precio != null) return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(row.precio);
  if (row.precio_usd != null) return new Intl.NumberFormat("es-PE", { style: "currency", currency: "USD" }).format(row.precio_usd);
  return "—";
}

// D-33 — combobox replacing the separate Tour/Agencia <select> pair. Typing
// resolves a tour + its (possibly only) agencia in one pick; recientes surface
// first when the query is empty (server already orders that way).
export const TourAgenciaSearch = forwardRef<HTMLInputElement, {
  vendedorId?: string;
  onSelect: (row: TourSearchRow) => void;
  tabIndex?: number;
  onEnterSubmit?: () => void;
}>(function TourAgenciaSearch({ vendedorId, onSelect, tabIndex, onEnterSubmit }, ref) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<TourSearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fetchResults(q: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (vendedorId) params.set("vendedor_id", vendedorId);
    fetch(`/api/ventas/tour-search?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setResults(Array.isArray(data) ? data : []);
        setActiveIndex(-1);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }

  function handleFocus() {
    setOpen(true);
    if (query === "") fetchResults("");
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(v), 300);
  }

  function commit(row: TourSearchRow) {
    setQuery(row.nombre);
    setOpen(false);
    setActiveIndex(-1);
    onSelect(row);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && activeIndex >= 0 && results[activeIndex]) {
        commit(results[activeIndex]);
      } else if (onEnterSubmit) {
        onEnterSubmit();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const listboxId = "tour-agencia-search-listbox";

  return (
    <div className="relative">
      <input
        ref={ref}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        tabIndex={tabIndex}
        placeholder="Busca un tour…"
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full px-3 py-2 rounded-lg border border-gold/30 bg-canvas"
      />
      {open && (
        <ul id={listboxId} role="listbox" className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-gold/30 bg-canvas shadow-lg font-nunito text-sm">
          {loading ? (
            <li className="px-3 py-2 text-text-espresso-soft">Buscando…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-text-espresso-soft">Sin resultados</li>
          ) : (
            results.map((row, i) => (
              <li
                key={row.tour_id}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => { e.preventDefault(); commit(row); }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`px-3 py-2 cursor-pointer flex justify-between gap-3 ${i === activeIndex ? "bg-gold/10" : ""}`}
              >
                <span>
                  {row.nombre}
                  {row.es_reciente && <span className="ml-2 text-xs text-text-espresso-soft">reciente</span>}
                  {row.agencia_nombre && <span className="block text-xs text-text-espresso-soft">{row.agencia_nombre}</span>}
                </span>
                <span className="tabular-nums shrink-0">{formatPrecio(row)}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
});
