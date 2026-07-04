// apps/tours/web/src/app/layout.tsx
// Root layout — loads fonts (Playfair, Nunito Sans, Yeseva One) via next/font/google
// and exposes CSS vars (--font-playfair-display, --font-nunito-sans, --font-yeseva-one)
// that globals.css @theme block maps to Tailwind tokens.
import type { Metadata } from "next";
import { Playfair_Display, Nunito_Sans, Yeseva_One } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-playfair-display",
  display: "swap",
});

const nunito = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-nunito-sans",
  display: "swap",
});

const yeseva = Yeseva_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-yeseva-one",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tours Panel",
  description: "Panel contable para agencias de tours — Cusco, Perú",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${playfair.variable} ${nunito.variable} ${yeseva.variable}`}>
      <body className="bg-peach-cream text-text-espresso font-nunito antialiased">
        {children}
      </body>
    </html>
  );
}