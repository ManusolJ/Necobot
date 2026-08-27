FROM node:22.16.0-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22.16.0-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

COPY assets ./assets
COPY db/migrations ./db/migrations

RUN groupadd -r botuser \
  && useradd -r -g botuser botuser \
  && mkdir -p /app/.model-cache \
  && chown -R botuser:botuser /app/.model-cache

USER botuser

CMD ["node", "dist/app.js"]