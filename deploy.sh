#!/usr/bin/env bash
set -euo pipefail

echo "=== Deploying in process ==="

echo "[1/5] Pulling latest changes..."
git pull origin main

echo "[2/5] Stopping bot..."
docker compose stop bot

echo "[3/5] Rebuilding and starting bot..."
docker compose up -d --build --no-deps bot

echo "[4/5] Running database migrations..."
docker compose exec bot npm run db:migrate

echo "[5/5] Cleaning up old images..."
docker image prune -f

echo "=== Deploy complete ==="