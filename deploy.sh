#!/bin/bash
set -euo pipefail

# Manuelles Deployment auf turing (von einer Maschine mit SSH-Zugang,
# z. B. aus dem LAN). Das Image kommt aus der GitHub-Registry – gebaut
# und gepusht von der Pipeline (.github/workflows/build.yml).
#
# Ablauf auf dem Server: Repo-Checkout aktualisieren, dann mpm compose up
# (zieht das Image über pull_policy: always und startet den Container
# hinter Traefik neu).
#
# Variablen:
#   DEPLOY_HOST  SSH-Ziel (Standard: root@turing)
#   REMOTE_DIR   Checkout-Pfad auf dem Server
#   REPO_URL     Repo-URL für den Server-Checkout
DEPLOY_HOST="${DEPLOY_HOST:-root@turing}"
REMOTE_DIR="${REMOTE_DIR:-/mnt/alpha/manifest/server/public/firstdorsal-web}"
REPO_URL="${REPO_URL:-https://github.com/firstdorsal/firstdorsal-web.git}"

# Remote-Schritte über sh -s (die Login-Shell auf turing ist fish).
ssh "${DEPLOY_HOST}" "sh -s" <<EOF
set -eu
if [ ! -d "${REMOTE_DIR}/.git" ]; then
    git clone "${REPO_URL}" "${REMOTE_DIR}"
fi
cd "${REMOTE_DIR}"
git fetch origin main
# --ff-only: lokale Änderungen (z. B. values.yaml) niemals stillschweigend
# überschreiben – dann lieber laut scheitern.
git merge --ff-only origin/main
cd deployment
mpm compose up
EOF

echo "Deployment fertig: https://firstdorsal.eu"
