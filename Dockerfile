# syntax=docker/dockerfile:1
# Build läuft vollständig im Container – lokal und in der GitHub-Pipeline
# identisch (aufgerufen über build.sh). Tests laufen als Teil des Builds:
# schlägt ein Test fehl (Vitest oder cargo test), gibt es kein Image.
#
# Laufzeit-Image: ein einziges Rust-Binary (axum), das die statische
# Astro-Seite ausliefert und den Kunden-Chat bedient – Ersatz für den
# früheren static-web-server. Mit --build-arg RUNTIME_FLAVOR="-alpine"
# gibt es stattdessen eine Shell zum Debuggen.
ARG RUNTIME_FLAVOR=""

FROM docker.io/library/node:22.22.3-alpine AS web-build
WORKDIR /app
ENV CI=true \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# pnpm-Version kommt aus dem packageManager-Feld der package.json (corepack).
RUN corepack enable
# Workspace-Manifeste (Wurzel + In-Repo-Pakete unter packages/) vor dem
# Install, damit der Lockfile aufgeht und der Layer-Cache greift. Der
# Quelltext von @webchat/react wird direkt konsumiert (kein Extra-Build).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages packages
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY astro.config.mjs tsconfig.json components.json vitest.config.ts ./
COPY public public
COPY src src
RUN pnpm test
RUN pnpm build

# Rust-Backend als statisches musl-Binary (scratch-tauglich). TLS für den
# SMTP-Versand kommt über rustls + eingebettete webpki-roots – das Image
# braucht keine System-Zertifikate.
FROM docker.io/library/rust:1.94-alpine AS server-build
RUN apk add --no-cache musl-dev
WORKDIR /app
# Abhängigkeiten zuerst bauen (Docker-Layer-Cache): Dummy-lib+main genügt.
# webchat ist Bibliothek (src/lib.rs) + Binary (src/main.rs).
COPY server/Cargo.toml server/Cargo.lock ./
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    mkdir src \
    && echo '' > src/lib.rs \
    && echo 'fn main() {}' > src/main.rs \
    && cargo build --release --locked \
    && rm -rf src
COPY server/migrations migrations
COPY server/src src
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    touch src/lib.rs src/main.rs && cargo test --release --locked && cargo build --release --locked

# Laufzeitbasis per RUNTIME_FLAVOR: "" = scratch, "-alpine" = Debug-Shell.
FROM scratch AS runtime
FROM docker.io/library/alpine:3.22 AS runtime-alpine
FROM runtime${RUNTIME_FLAVOR}
COPY --from=server-build /app/target/release/webchat /webchat
COPY --from=web-build /app/dist /public
ENV PORT=80 \
    STATIC_DIR=/public \
    DATA_DIR=/data
EXPOSE 80
ENTRYPOINT ["/webchat"]
