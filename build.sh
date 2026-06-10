#!/bin/bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# Baut das Website-Image vollständig im Container – lokal und in der
# GitHub-Pipeline identisch (die Pipeline ruft genau dieses Skript auf).
# Tests laufen im Build mit; ohne grüne Tests entsteht kein Image.
#
# Variablen:
#   IMAGE           Image-Name (Standard: firstdorsal-web)
#   TAG             Zusätzlicher Tag (Standard: kurzer Git-Hash)
#   RUNTIME_FLAVOR  ""=scratch (Standard), "-alpine"=mit Shell zum Debuggen
#   OUT_TAR         Pfad: Image zusätzlich als tar exportieren (für Deploy)
IMAGE="${IMAGE:-firstdorsal-web}"
TAG="${TAG:-$(git rev-parse --short HEAD)}"
RUNTIME_FLAVOR="${RUNTIME_FLAVOR:-}"
OUT_TAR="${OUT_TAR:-}"

# Reproduzierbarkeit: Zeitstempel aus dem letzten Commit statt Buildzeit.
SOURCE_DATE_EPOCH="$(git log -1 --pretty=%ct)"
export SOURCE_DATE_EPOCH
export BUILDKIT_PROGRESS="${BUILDKIT_PROGRESS:-plain}"

docker buildx build \
    --build-arg RUNTIME_FLAVOR="${RUNTIME_FLAVOR}" \
    --provenance=false \
    -t "${IMAGE}:${TAG}" \
    -t "${IMAGE}:latest" \
    --load \
    .

if [[ -n "${OUT_TAR}" ]]; then
    docker save "${IMAGE}:${TAG}" "${IMAGE}:latest" -o "${OUT_TAR}"
    echo "Image als tar exportiert: ${OUT_TAR}"
fi

echo "Image gebaut: ${IMAGE}:${TAG} (+ ${IMAGE}:latest)"
