import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function AppHome() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (role === "vendedor") redirect("/ventas");
  // Plan 02 replaces with real dashboard (UI-SPEC S2). MVP placeholder.
  return (
    <div className="bg-peach-cream min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-playfair text-primary text-[38px] font-semibold mb-3">Resumen contable</h1>
        <p className="text-text-espresso-soft font-nunito mb-4">El dashboard completo se entregará en Plan 02.1-02.</p>
        <a href="/ventas" className="inline-block border border-gold text-primary px-6 py-2.5 rounded-full font-nunito font-semibold hover:bg-gold/10">
          Ir a Ventas
        </a>
      </div>
    </div>
  );
}