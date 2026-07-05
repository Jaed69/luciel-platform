# syntax=docker/dockerfile:1
# Multi-stage node:22-slim build + node:22-slim runtime for Next.js 16 standalone.
# Build context MUST be repo root — pnpm workspace needs the root lockfile.
#   docker build -t luciel-platform-tours-web -f apps/tours/web/Dockerfile .
FROM node:22-slim AS build
ENV PNPM_CONFIG_STRICT_DEP_BUILDS=false
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/tours/web/package.json apps/tours/web/
COPY apps/landing/package.json apps/landing/
RUN pnpm install --frozen-lockfile
COPY apps/tours/web/ apps/tours/web/
RUN pnpm --filter @luciel-platform/tours build

# Next.js 16 standalone: copy .next/standalone + .next/static + public/
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/apps/tours/web/.next/standalone ./
COPY --from=build /app/apps/tours/web/.next/static ./apps/tours/web/.next/static
COPY --from=build /app/apps/tours/web/public ./apps/tours/web/public
EXPOSE 3000
CMD ["node", "apps/tours/web/server.js"]