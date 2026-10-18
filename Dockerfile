
# ==============================================================================
# PromptNova MachineMemory - Google Cloud Run
# ==============================================================================

# Stage 1: Build the Vite frontend
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .

ARG GEMINI_API_KEY
ARG GEMINI_API_KEY_2
ARG GEMINI_API_KEY_3
ARG SESSION_SECRET
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_DATABASE_ID

ENV GEMINI_API_KEY=$GEMINI_API_KEY
ENV GEMINI_API_KEY_2=$GEMINI_API_KEY_2
ENV GEMINI_API_KEY_3=$GEMINI_API_KEY_3
ENV SESSION_SECRET=$SESSION_SECRET
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_DATABASE_ID=$VITE_FIREBASE_DATABASE_ID

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