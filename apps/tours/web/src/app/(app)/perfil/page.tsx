import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PasswordForm } from "./PasswordForm";

export default async function PerfilPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  // No role gate — any authed user (D-08) can change their own password.
  const email = (session.user as any)?.email as string;
  const role = (session.user as any)?.role as string;

  return (
    <div>
      <h1 className="font-playfair text-primary text-[38px] font-semibold mb-6">Mi perfil</h1>
      <div className="rounded-lg border border-gold/30 bg-canvas p-6 max-w-[640px] mb-6">
        <p className="font-nunito text-text-espresso mb-2">
          <span className="font-semibold text-text-espresso-soft">Correo: </span>{email}
        </p>
        <p className="font-nunito text-text-espresso">
          <span className="font-semibold text-text-espresso-soft">Rol: </span>{role}
        </p>
      </div>
      <PasswordForm />
    </div>
  );
}