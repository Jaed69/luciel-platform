# syntax=docker/dockerfile:1
# Multi-stage: node:22-slim build -> nginx:alpine runtime. Mirrors apps/landing/Dockerfile.
# Build context MUST be repo root — pnpm workspace needs the root lockfile.
#   docker build -t luciel-platform-lemon -f apps/lemon/Dockerfile .
FROM node:22-slim AS build
ENV PNPM_CONFIG_STRICT_DEP_BUILDS=false
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/lemon/package.json apps/lemon/
RUN pnpm install --frozen-lockfile
COPY apps/lemon/ apps/lemon/
RUN pnpm --filter @luciel/lemon build

FROM nginx:alpine AS runtime
COPY apps/lemon/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/apps/lemon/dist /usr/share/nginx/html
EXPOSE 8080
