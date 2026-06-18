#!/usr/bin/env bash
set -euo pipefail

echo "=== Deploying in process ==="

echo "[1/4] Pulling latest changes..."
git pull origin main

echo "[2/4] Stopping bot..."
docker compose stop bot

echo "[3/4] Rebuilding and starting bot..."
docker compose up -d --build --no-deps bot

echo "[4/4] Cleaning up old images..."
docker image prune -f

echo "=== Deploy complete ==="