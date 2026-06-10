#!/bin/bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# Baut das Image über build.sh, lädt es per SSH auf den Server (docker load
# statt Registry – das deployte Artefakt ist exakt das gebaute Image) und
# aktualisiert das mpm-Deployment hinter Traefik.
#
# Funktioniert identisch lokal und aus der GitHub-Pipeline; die Pipeline
# ruft genau dieses Skript auf.
#
# Variablen:
#   DEPLOY_HOST  SSH-Ziel (Standard: root@firstdorsal.eu = turing)
#   REMOTE_DIR   Checkout-Pfad auf dem Server
#   REPO_URL     Repo-URL für den Server-Checkout
DEPLOY_HOST="${DEPLOY_HOST:-root@firstdorsal.eu}"
REMOTE_DIR="${REMOTE_DIR:-/mnt/alpha/manifest/server/public/firstdorsal-web}"
REPO_URL="${REPO_URL:-https://github.com/firstdorsal/firstdorsal-web.git}"

TAR="$(mktemp -t firstdorsal-web-XXXXXX.tar)"
trap 'rm -f "${TAR}"' EXIT

OUT_TAR="${TAR}" bash build.sh

scp "${TAR}" "${DEPLOY_HOST}:/tmp/firstdorsal-web.tar"

# Remote-Schritte über sh -s (die Login-Shell auf turing ist fish).
ssh "${DEPLOY_HOST}" "sh -s" <<EOF
set -eu
docker load -i /tmp/firstdorsal-web.tar
rm -f /tmp/firstdorsal-web.tar
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
