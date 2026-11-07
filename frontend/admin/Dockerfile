# Admin dashboard (teachers & superadmin): Next.js standalone server.
# NEXT_PUBLIC_* values and the /admin base path are baked in at build time.
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GAME_URL
ARG NEXT_BASE_PATH=/admin
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_GAME_URL=$NEXT_PUBLIC_GAME_URL \
    NEXT_BASE_PATH=$NEXT_BASE_PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN test -n "$NEXT_PUBLIC_API_URL" && test -n "$NEXT_PUBLIC_GAME_URL" \
    || (echo "NEXT_PUBLIC_API_URL and NEXT_PUBLIC_GAME_URL are required" && exit 1)
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3002
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3002
CMD ["node", "server.js"]
