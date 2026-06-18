FROM node:22.16.0-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22.16.0-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

COPY assets ./assets
COPY db/migrations ./db/migrations

RUN addgroup -S botuser && adduser -S botuser -G botuser
USER botuser

CMD ["node", "dist/app.js"]