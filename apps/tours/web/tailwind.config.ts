// apps/tours/web/tailwind.config.ts
// Tailwind v4 is CSS-first — most config lives in `src/app/globals.css` as `@theme` directives.
// This file stays minimal to satisfy typecheck; v4 scans CSS for tokens.
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
  ],
};

export default config;