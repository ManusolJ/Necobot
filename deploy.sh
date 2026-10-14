#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DEPLOY_PULLED:-}" ]]; then
  echo "=== Deploying in process ==="

  echo "[1/5] Pulling latest changes..."
  git pull origin main

  DEPLOY_PULLED=1 exec bash "$0" "$@"
fi

NODE_VERSION="$(cat .node-version)"

echo "[2/5] Rebuilding necoarc model..."
if command -v ollama >/dev/null 2>&1; then
  ollama create necoarc -f ai/necoarc.Modelfile
else
  echo "ollama not installed; skipping model rebuild"
fi

echo "[3/5] Building bot image (Node ${NODE_VERSION})..."
docker compose build --build-arg NODE_VERSION="${NODE_VERSION}" bot

echo "[4/5] Restarting bot..."
docker compose up -d --no-deps bot

echo "[5/5] Cleaning up old images..."
docker image prune -f

echo "=== Deploy complete ==="
