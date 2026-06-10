# syntax=docker/dockerfile:1
# Build läuft vollständig im Container – lokal und in der GitHub-Pipeline
# identisch (aufgerufen über build.sh). Tests laufen als Teil des Builds:
# schlägt ein Test fehl, gibt es kein Image.
#
# Laufzeit-Image: static-web-server auf scratch-Basis. Mit
# --build-arg RUNTIME_FLAVOR="-alpine" gibt es stattdessen eine Shell
# zum Debuggen.
ARG SWS_VERSION=2.42.0
ARG RUNTIME_FLAVOR=""

FROM docker.io/library/node:22.22.3-alpine AS build
WORKDIR /app
ENV CI=true \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# pnpm-Version kommt aus dem packageManager-Feld der package.json (corepack).
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY astro.config.mjs tsconfig.json components.json vitest.config.ts ./
COPY public public
COPY src src
RUN pnpm test
RUN pnpm build

FROM docker.io/joseluisq/static-web-server:${SWS_VERSION}${RUNTIME_FLAVOR}
COPY sws.toml /etc/sws.toml
COPY --from=build /app/dist /public
EXPOSE 80
CMD ["--config-file", "/etc/sws.toml"]
