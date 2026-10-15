# ==============================================================================
# PromptNova MachineMemory - Production Dockerfile for Google Cloud Run
# ==============================================================================
# Multi-stage build:
#   Stage 1 (builder): Installs dependencies and compiles Vite frontend into /dist
#   Stage 2 (runner): Lightweight production image with Node.js and Express
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies required for Vite build)
RUN npm install --legacy-peer-deps

# Copy application source code
COPY . .

# Compile Vite client bundle
RUN npm run build

# ==============================================================================
# Stage 2: Production Container
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# Google Cloud Run injects PORT (typically 8080)
ENV PORT=8080

# Copy package manifests and install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

# Install tsx globally in container to run TypeScript server
RUN npm install -g tsx

# Copy compiled frontend from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Copy server and necessary configurations
COPY server.ts ./
COPY tsconfig.json ./
COPY firebase-blueprint.json* ./

# Non-root user for security hardening
USER node

# Expose target port
EXPOSE 8080

# Launch server
CMD ["tsx", "server.ts"]
