// apps/tours/web/next.config.ts
// Next.js 16 standalone output for Traefik deployment (D-01 — tours-web behind Traefik router).
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: 1024 * 1024 },
  },
};

export default nextConfig;