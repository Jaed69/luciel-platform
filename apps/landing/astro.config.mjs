// apps/landing/astro.config.mjs
// Astro 7 static output — zero-JS, AdSense/SEO baseline (D-01).
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { alternates, routes } from './src/i18n/routes.ts';

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

const SITE = 'https://luciel.dev';

// Spanish slugs differ from English ones, so the sitemap integration's own i18n option (which pairs pages by
// identical path) cannot link them. Pair them through the route map instead: every URL lists all its language versions.
const withAlternates = (item) => {
  const path = new URL(item.url).pathname;
  const page = Object.keys(routes).find((key) => alternates(key).some((version) => version.path === path));
  if (!page) return item;
  const links = alternates(page).map(({ locale, path: href }) => ({ url: `${SITE}${href}`, lang: locale }));
  return links.length > 1 ? { ...item, links } : item;
};

export default defineConfig({
  site: SITE,
  output: 'static',
  outDir: './dist',
  // English at the root, Spanish under /es/. Pages and their translated slugs are routed in src/i18n/routes.ts.
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    routing: { prefixDefaultLocale: false },
  },
  // Order matters: the sitemap integration must finish before rootSitemap copies its output.
  integrations: [mdx(), sitemap({ filter: (page) => !/\/404(\.html|\/)?$/.test(page), serialize: withAlternates }), rootSitemap],
  // @tailwindcss/vite is a Vite plugin (not an Astro integration) — Tailwind v4.
  vite: {
    plugins: [tailwindcss()],
  },
});
