# ── Stage 1: Backend ──
# devDependencies are required here: the NestJS build (nest build/tsc) runs
# from them. `npm ci --only=production` is gone in npm 10+ and would also
# break the compile step.
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY backend/ ./
RUN npm run build

# Prune to production dependencies for the runtime image.
RUN npm prune --omit=dev

# ── Stage 2: Frontend ──
# next.config.ts must set output: "standalone" — stage 3 copies
# .next/standalone, which does not exist otherwise.
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: Production ──
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
# Default ports; overridden per-service by docker-compose / orchestrator env.
# Next standalone reads PORT directly; the backend reads PORT via ConfigModule.
ENV PORT=3000
ENV BACKEND_PORT=4000

# Backend: compiled output + pruned production node_modules
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/package.json ./backend/

# Frontend (standalone output)
COPY --from=frontend-builder /app/frontend/.next/standalone ./
COPY --from=frontend-builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/frontend/public ./frontend/public

EXPOSE 3000 4000

# Run both processes; in production prefer splitting into two images/services
# (build --target backend-builder / a dedicated runtime stage per service).
# NOTE: Next standalone emits server.js at the COPY ROOT (/app), not /app/frontend.
CMD ["sh", "-c", "BACKEND_PORT=${BACKEND_PORT:-4000} PORT=${BACKEND_PORT:-4000} node backend/dist/main.js & node server.js"]
