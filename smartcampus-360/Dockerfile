# SmartCampus 360 — Production Dockerfile
# Multi-stage build: compile the Vite frontend, then run the Express server.

# ---------- Stage 1: Build the frontend ----------
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Native build tools for argon2 / better-sqlite3
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ libsqlite3-dev \
 && rm -rf /var/lib/apt/lists/*

# Install dependencies (cache layer)
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copy source and build
COPY . .
RUN npm run build

# Prune dev dependencies for the production image
RUN npm prune --omit=dev

# ---------- Stage 2: Runtime ----------
FROM node:20-bookworm-slim AS runtime

WORKDIR /app

# Runtime native libs required by better-sqlite3 / argon2
RUN apt-get update \
 && apt-get install -y --no-install-recommends libsqlite3-0 \
 && rm -rf /var/lib/apt/lists/*

# Copy built application and pruned node_modules from the builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.env.example ./.env.example

# Persistent data directory for SQLite + uploads
RUN mkdir -p /app/data /app/uploads \
 && chown -R node:node /app/data /app/uploads

ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_PATH=/app/data/smartcampus.db
ENV FILE_STORAGE_PATH=/app/uploads

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

USER node

CMD ["node", "server.js"]
