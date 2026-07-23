type Variant =
  | "abierta"
  | "cerrada"
  | "revertida"
  | "abierto"
  | "en_revision"
  | "resuelto"
  | "descartado"
  | "active"
  | "inactive"
  | "insert"
  | "update"
  | "delete";

const styles: Record<Variant, string> = {
  abierta: "bg-amber-warning/20 text-amber-warning border-amber-warning",
  cerrada: "bg-wine-muted text-on-primary border-wine-muted",
  revertida: "bg-stone-wall text-text-espresso-soft border-stone-wall",
  abierto: "bg-amber-warning/20 text-amber-warning border-amber-warning",
  en_revision: "bg-gold-light/30 text-text-espresso border-gold",
  resuelto: "bg-wine-muted text-on-primary border-wine-muted",
  descartado: "bg-stone-wall text-text-espresso-soft border-stone-wall",
  active: "bg-wine-muted text-on-primary border-wine-muted",
  inactive: "bg-stone-wall text-text-espresso-soft border-stone-wall",
  insert: "bg-wine-light-tint text-primary border-transparent",
  update: "bg-gold-light/30 text-text-espresso border-gold",
  delete: "bg-chili-tint text-chili-red border-transparent",
};

export function StatusBadge({ variant, children }: { variant: Variant; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded-md px-3 py-1 text-[13px] font-semibold border ${styles[variant]}`}>
      {children}
    </span>
  );
}