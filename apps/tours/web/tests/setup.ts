// apps/tours/web/tests/setup.ts
// Wave 0 — vitest global setup. jest-dom matchers + auto-cleanup after each test
// (vitest doesn't auto-cleanup React renders by default — accumulated renders
// cause spurious "Found multiple elements" errors between tests).
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});