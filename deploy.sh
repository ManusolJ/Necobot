#!/usr/bin/env bash
set -euo pipefail

echo "=== Deploying in process ==="

echo "[1/5] Pulling latest changes..."
git pull origin main

echo "[2/5] Rebuilding necoarc model..."
if command -v ollama >/dev/null 2>&1; then
  ollama create necoarc -f ai/necoarc.Modelfile
else
  echo "ollama not installed; skipping model rebuild"
fi

echo "[3/5] Stopping bot..."
docker compose stop bot

echo "[4/5] Rebuilding and starting bot..."
docker compose up -d --build --no-deps bot

echo "[5/5] Cleaning up old images..."
docker image prune -f

echo "=== Deploy complete ==="