// apps/tours/web/vitest.config.ts
// Wave 0 scaffold (VALIDATION.md) — jsdom env for component tests, setup imports jest-dom matchers.
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    // Date formatting in tests assumes UTC (as in CI); pin it so local runs match.
    env: { TZ: "UTC" },
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
});