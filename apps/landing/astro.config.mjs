// apps/landing/astro.config.mjs
// Astro 7 static output — zero-JS, AdSense/SEO baseline (D-01).
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// @astrojs/sitemap emits sitemap-index.xml plus numbered chunks. Serve the index at /sitemap.xml too,
// the conventional location crawlers probe first; an index stays valid for any number of chunks.
const rootSitemap = {
  name: 'root-sitemap',
  hooks: {
    'astro:build:done': ({ dir }) => {
      const out = fileURLToPath(dir);
      copyFileSync(`${out}sitemap-index.xml`, `${out}sitemap.xml`);
    },
  },
};

export default defineConfig({
  site: 'https://luciel.dev',
  output: 'static',
  outDir: './dist',
  // Order matters: the sitemap integration must finish before rootSitemap copies its output.
  integrations: [mdx(), sitemap({ filter: (page) => !/\/404(\.html|\/)?$/.test(page) }), rootSitemap],
  // @tailwindcss/vite is a Vite plugin (not an Astro integration) — Tailwind v4.
  vite: {
    plugins: [tailwindcss()],
  },
});
