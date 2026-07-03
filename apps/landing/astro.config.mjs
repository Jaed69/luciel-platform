// apps/landing/astro.config.mjs
// Astro 7 static output — zero-JS, AdSense/SEO baseline (D-01).
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://luciel.dev',
  output: 'static',
  outDir: './dist',
  integrations: [mdx(), sitemap()],
  // @tailwindcss/vite is a Vite plugin (not an Astro integration) — Tailwind v4.
  vite: {
    plugins: [tailwindcss()],
  },
});
