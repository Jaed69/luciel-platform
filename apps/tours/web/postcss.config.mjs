// apps/tours/web/postcss.config.mjs
// Tailwind v4 in Next.js 16 uses the PostCSS plugin (NOT the Vite plugin —
// Next.js runs Turbopack, not Vite; the Astro pattern does not apply here).
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};