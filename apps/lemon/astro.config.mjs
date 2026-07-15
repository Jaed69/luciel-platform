// apps/lemon/astro.config.mjs
// Astro 7 static output — content hub, mirrors apps/landing's stack decision.
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://lemon.luciel.dev',
  output: 'static',
  outDir: './dist',
  // @tailwindcss/vite is a Vite plugin (not an Astro integration) — Tailwind v4.
  vite: {
    plugins: [tailwindcss()],
  },
});
