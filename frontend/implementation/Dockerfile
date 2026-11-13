# Game (student app): Next.js static export, served by Caddy together with the
# reverse proxy. NEXT_PUBLIC_* values are baked in at build time, so changing
# the server address means rebuilding this image (docker compose up -d --build).
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY . .
ARG NEXT_PUBLIC_PREDICTION_MODE=partner
ARG NEXT_PUBLIC_PREDICTION_ENDPOINT
ARG NEXT_PUBLIC_DRAW_INPUT_MODE=pointer
# Sends levelId with each /predict so the backend can apply per-level AI difficulty.
ARG NEXT_PUBLIC_PREDICTION_SEND_CONTEXT=1
ENV NEXT_PUBLIC_PREDICTION_SEND_CONTEXT=$NEXT_PUBLIC_PREDICTION_SEND_CONTEXT \
    NEXT_PUBLIC_PREDICTION_MODE=$NEXT_PUBLIC_PREDICTION_MODE \
    NEXT_PUBLIC_PREDICTION_ENDPOINT=$NEXT_PUBLIC_PREDICTION_ENDPOINT \
    NEXT_PUBLIC_DRAW_INPUT_MODE=$NEXT_PUBLIC_DRAW_INPUT_MODE \
    NEXT_TELEMETRY_DISABLED=1
RUN test -n "$NEXT_PUBLIC_PREDICTION_ENDPOINT" || (echo "NEXT_PUBLIC_PREDICTION_ENDPOINT is required" && exit 1)
RUN npm run build

# Caddy serves the exported game and proxies /api, /predict and /admin.
# Its config is mounted from deploy/Caddyfile by docker-compose.yml.
FROM caddy:2.10-alpine
COPY --from=build /app/out /srv/game
