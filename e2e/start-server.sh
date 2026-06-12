#!/bin/bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Startet den Rust-Server für die E2E-Tests: frischer Astro-Build,
# frische SQLite-DB und ein leerer Mail-Ordner (MAIL_FILE_DIR) je Lauf.
pnpm build

rm -rf e2e/.tmp
mkdir -p e2e/.tmp/mails e2e/.tmp/data

exec env \
    PORT=8788 \
    STATIC_DIR="$(pwd)/dist" \
    DATA_DIR="$(pwd)/e2e/.tmp/data" \
    PUBLIC_URL=http://localhost:8788 \
    MAIL_FILE_DIR="$(pwd)/e2e/.tmp/mails" \
    OPERATOR_EMAILS=operator@firstdorsal.eu \
    WHISPER_URL=http://localhost:8799 \
    WHISPER_LANGUAGE=de \
    E2E_SEED=1 \
    cargo run --manifest-path server/Cargo.toml
