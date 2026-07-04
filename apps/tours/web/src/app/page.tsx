// apps/tours/web/src/app/page.tsx
// Root route — role-aware redirect: vendedor → /ventas, others → /ventas (Plan 02 dashboard).
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  // Plan 02 replaces this with the real dashboard (UI-SPEC S2). MVP slice redirects to /ventas.
  redirect("/ventas");
}