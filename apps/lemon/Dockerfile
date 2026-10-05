# syntax=docker/dockerfile:1
# Multi-stage: node:22.23.3-slim build -> nginx:1.31.6-alpine runtime. Mirrors apps/landing/Dockerfile.
# Build context MUST be repo root — pnpm workspace needs the root lockfile.
#   docker build -t luciel-platform-lemon -f apps/lemon/Dockerfile .
FROM node:22.23.3-slim AS build
ENV PNPM_CONFIG_STRICT_DEP_BUILDS=false \
    npm_config_store_dir=/pnpm/store
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Download deps from the lockfile alone (cached layer + BuildKit store cache), install offline.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch
COPY apps/lemon/package.json apps/lemon/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prefer-offline
COPY apps/lemon/ apps/lemon/
RUN pnpm --filter @luciel/lemon build

FROM nginx:1.31.6-alpine AS runtime
COPY apps/lemon/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/apps/lemon/dist /usr/share/nginx/html
EXPOSE 8080
