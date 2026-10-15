
# ==============================================================================
# PromptNova MachineMemory - Google Cloud Run
# ==============================================================================

# Stage 1: Build the Vite frontend
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build


# Stage 2: Production runtime
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps \
    && npm cache clean --force

# Copy frontend build output
COPY --from=builder --chown=node:node /app/dist ./dist

# Copy public assets if your server uses this directory at runtime
COPY --from=builder --chown=node:node /app/public ./public

# Copy server files
COPY --chown=node:node server.ts tsconfig.json ./

USER node

EXPOSE 8080

CMD ["npm", "start"]