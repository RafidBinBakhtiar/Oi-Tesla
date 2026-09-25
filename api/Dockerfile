# syntax=docker/dockerfile:1

# ── deps: full install (dev deps needed to compile TypeScript and run tests)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── build: compile to dist/ (also the image the `api-test` compose service uses)
FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

# ── runtime: production deps + compiled JS only
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
