"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { FloatingLabelInput } from "@/components/FloatingLabelInput";
import { showToast } from "@/components/Toast";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", { identifier, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      showToast("error", "Correo/usuario o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-peach-cream flex items-center justify-center px-4">
      <div className="w-full max-w-[420px] text-center">
        <p className="font-yeseva text-gold text-[40px] leading-none mb-2">Tours</p>
        <h1 className="font-playfair text-primary text-[38px] font-semibold mb-6">Iniciar sesión</h1>
        <form onSubmit={handleSubmit} className="space-y-6 text-left">
          <FloatingLabelInput
            label="Correo o usuario"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
          <FloatingLabelInput
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Iniciando…" : "Iniciar sesión"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-text-espresso-soft font-nunito">
          ¿Olvidaste tu contraseña? Contacta al administrador.
        </p>
      </div>
    </main>
  );
}