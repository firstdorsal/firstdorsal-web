#!/bin/bash
set -euo pipefail

# Echtes whisper-asr-webservice für die E2E-Tests – dasselbe Image wie in
# Produktion (deployment/templates/docker-compose.yaml), nur mit dem
# kleinen tiny-Modell für Testtempo. Der erste Lauf lädt Image und Modell
# (einige hundert MB); das Modell überlebt im benannten Volume.
exec docker run --rm --name fd-e2e-whisper \
    -p 8799:9000 \
    -e ASR_ENGINE=faster_whisper \
    -e ASR_MODEL=tiny \
    -v fd-e2e-whisper-cache:/root/.cache \
    docker.io/onerahmet/openai-whisper-asr-webservice:v1.9.1
