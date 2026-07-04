# syntax=docker/dockerfile:1
# Multi-stage: node:22-slim build -> nginx:alpine runtime (D-02).
# Build context MUST be repo root — pnpm workspace needs the root lockfile.
#   docker build -t luciel-platform-landing -f apps/landing/Dockerfile .
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/landing/package.json apps/landing/
RUN pnpm install --frozen-lockfile --config.strictDepBuilds=false
COPY apps/landing/ apps/landing/
RUN pnpm --filter @luciel/landing build

FROM nginx:alpine AS runtime
COPY apps/landing/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/apps/landing/dist /usr/share/nginx/html
EXPOSE 8080
