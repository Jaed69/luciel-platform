import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { FeedbackButton } from "@/components/FeedbackButton";

const NAV_ITEMS = [
  { label: "Resumen contable", href: "/", roles: ["admin", "contabilidad"] },
  { label: "Ventas", href: "/ventas", roles: ["admin", "contabilidad", "vendedor"] },
  { label: "Liquidaciones", href: "/liquidaciones", roles: ["admin", "contabilidad", "vendedor"] },
  { label: "Catálogos", href: "/catalogos/agencias", roles: ["admin", "contabilidad"] },
  { label: "Saldos agencias", href: "/agencias", roles: ["admin", "contabilidad"] },
  { label: "Auditoría", href: "/admin/auditoria", roles: ["admin"] },
  { label: "Usuarios", href: "/admin/usuarios", roles: ["admin"] },
  { label: "Solicitudes", href: "/solicitudes", roles: ["admin", "contabilidad", "vendedor"] },
  { label: "Perfil", href: "/perfil", roles: ["admin", "contabilidad", "vendedor"] },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = (session.user as any)?.role as string;
  const email = (session.user as any)?.email as string;
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <div className="min-h-screen bg-peach-cream flex flex-col">
      <nav className="bg-peach-cream border-b border-gold/30 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-yeseva text-primary text-xl">Tours</span>
        </div>
        <ul className="flex gap-4">
          {visibleItems.map((item) => (
            <li key={item.href}>
              <a href={item.href} className="text-sm font-nunito font-semibold text-primary hover:underline">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <span className="text-sm font-nunito text-text-espresso">{email} · {role}</span>
          <LogoutButton />
        </div>
      </nav>
      <main className="flex-1 px-6 py-6 max-w-[1200px] w-full mx-auto">{children}</main>
      <footer className="bg-espresso-wine text-on-dark-soft py-3 text-center text-[13px] font-nunito">
        © {new Date().getFullYear()} Tours Panel · Cusco, Perú
      </footer>
      <FeedbackButton />
    </div>
  );
}