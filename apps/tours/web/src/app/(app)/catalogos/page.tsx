import { redirect } from "next/navigation";

// /catalogos has no index UI — the nav and the invalid-entidad fallback both
// land on /catalogos/agencias, so the bare URL does too.
export default function CatalogosIndexPage() {
  redirect("/catalogos/agencias");
}
